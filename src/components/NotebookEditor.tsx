import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Editor } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import {
  Play, Loader2, Plus, Trash2, ChevronUp, ChevronDown, ChevronRight,
  Sparkles, Bug, BookOpen, Download, Upload, X, Zap, Square,
  Save, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { fetchUserApiKey, streamGeminiResponse } from "@/services/geminiService";
import { streamGroqFallback } from "@/services/groqFallbackService";
import { runPythonCode } from "@/utils/skulptRunner";
import { v4 as uuidv4 } from "uuid";
import { type CellSnapshot } from "@/utils/notebookContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type OutputItem =
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string };

interface Cell {
  id: string;
  code: string;
  outputs: OutputItem[];
  executionCount: number | null;
  isRunning: boolean;
  isAiLoading: boolean; // only used for "AI Generate"
  activeInput?: { prompt: string; resolve: (val: string) => void };
}

type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

/** Imperative handle exposed by NotebookEditor */
export type NotebookEditorHandle = {
  /** Returns a snapshot of all cells for context injection */
  getCells: () => CellSnapshot[];
};

interface NotebookEditorProps {
  code: string;
  onChange: (value: string) => void;
  /** Sends a message to the AI Chat sidebar */
  onSendToChat?: (message: string) => void;
  /** Called when user clicks Save — should persist code to DB */
  onSaveCode?: (code: string) => Promise<{ success: boolean }>;
  isRuntimeReady?: boolean;
}

// ── Global execution counter ──────────────────────────────────────────────────
let globalExecCounter = 0;

function makeCell(code = ""): Cell {
  return {
    id: uuidv4(),
    code,
    outputs: [],
    executionCount: null,
    isRunning: false,
    isAiLoading: false,
  };
}

// ── Helper: Parse or fallback ────────────────────────────────────────────────
function parseNotebookCode(rawCode: string): Cell[] {
  if (!rawCode) return [makeCell("")];
  try {
    const trimmed = rawCode.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0].id === "string") {
        return parsed.map((p: any) => makeCell(p.code));
      }
    }
  } catch (e) {
    // ignore parse error, fallback to legacy
  }
  
  // Legacy parsing (if using delimiters)
  if (rawCode.includes("# ─────────────────────")) {
    const parts = rawCode.split("# ─────────────────────").map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts.map(p => makeCell(p));
  }
  
  return [makeCell(rawCode)];
}

// ── Main Component ─────────────────────────────────────────────────────────────

export const NotebookEditor = forwardRef<NotebookEditorHandle, NotebookEditorProps>((
  {
    code,
    onChange,
    onSendToChat,
    onSaveCode,
    isRuntimeReady = true,
  },
  ref
) => {
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  const [cells, setCells] = useState<Cell[]>(() => parseNotebookCode(code));
  const [activeCell, setActiveCell] = useState<string>(cells[0]?.id || "");

  // ── Save status ───────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Expose getCells() to parent via ref ───────────────────────────────────
  useImperativeHandle(ref, () => ({
    getCells: () =>
      cells.map((c, i) => ({
        index: i + 1,
        code: c.code,
        outputs: c.outputs as CellSnapshot["outputs"],
        executionCount: c.executionCount,
      })),
  }));

  // ── Sync External ↔ Internal ─────────────────────────────────────────
  const lastExternalCode = useRef(code);
  useEffect(() => {
    if (code !== lastExternalCode.current) {
      lastExternalCode.current = code;
      const parsed = parseNotebookCode(code);
      setCells(parsed);
      if (parsed.length > 0) {
        setActiveCell(parsed[0].id);
      }
    }
  }, [code]);

  const serializeNotebook = (cellList: Cell[]) => {
    return JSON.stringify(cellList.map(c => ({ id: c.id, code: c.code })));
  };

  const handleCellCodeChange = useCallback(
    (cellId: string, value: string) => {
      setCells(prev => {
        const updated = prev.map(c => c.id === cellId ? { ...c, code: value } : c);
        
        // Serialize and sync to parent
        const serialized = serializeNotebook(updated);
        lastExternalCode.current = serialized;
        onChange(serialized);
        
        return updated;
      });
      // Mark as unsaved whenever any cell code changes
      setSaveStatus("unsaved");
    },
    [onChange]
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Monaco themes ─────────────────────────────────────────────────────────
  const handleEditorWillMount = (monaco: any) => {
    try {
      monaco.editor.defineTheme("nb-dark", {
        base: "vs-dark", inherit: true,
        rules: [
          { token: "keyword", foreground: "c792ea" },
          { token: "keyword.control", foreground: "f97583" },
          { token: "string", foreground: "c3e88d" },
          { token: "comment", foreground: "546e7a", fontStyle: "italic" },
          { token: "number", foreground: "f78c6c" },
          { token: "entity.name.function", foreground: "82aaff" },
          { token: "operator", foreground: "89ddff" },
        ],
        colors: {
          "editor.background": "#09090b",
          "editor.foreground": "#cdd3de",
          "editor.lineHighlightBackground": "#ffffff08",
          "editor.selectionBackground": "#4a4a7a66",
          "editorCursor.foreground": "#c792ea",
          "editorLineNumber.foreground": "#37474f",
          "editorLineNumber.activeForeground": "#78909c",
          "editorGutter.background": "#09090b",
        },
      });
      monaco.editor.defineTheme("nb-light", {
        base: "vs", inherit: true,
        rules: [
          { token: "keyword", foreground: "7c3aed" },
          { token: "string", foreground: "16803a" },
          { token: "comment", foreground: "94a3b8", fontStyle: "italic" },
          { token: "number", foreground: "c2410c" },
          { token: "entity.name.function", foreground: "1d4ed8" },
          { token: "operator", foreground: "0369a1" },
        ],
        colors: {
          "editor.background": "#fafafa",
          "editor.foreground": "#1e293b",
          "editor.lineHighlightBackground": "#00000008",
          "editorCursor.foreground": "#7c3aed",
          "editorLineNumber.foreground": "#94a3b8",
        },
      });
    } catch { /* themes already registered */ }
  };

  // ── Cell CRUD ──────────────────────────────────────────────────────────────
  const addCellAfter = (cellId: string, prefillCode = "") => {
    const newCell = makeCell(prefillCode);
    setCells(prev => {
      const idx = prev.findIndex(c => c.id === cellId);
      const updated = [...prev];
      updated.splice(idx + 1, 0, newCell);
      return updated;
    });
    setActiveCell(newCell.id);
  };

  const addCellAtEnd = () => {
    const newCell = makeCell();
    setCells(prev => [...prev, newCell]);
    setActiveCell(newCell.id);
  };

  const deleteCell = (cellId: string) => {
    setCells(prev => {
      if (prev.length === 1) return [makeCell()];
      const idx = prev.findIndex(c => c.id === cellId);
      const updated = prev.filter(c => c.id !== cellId);
      setActiveCell(updated[Math.min(idx, updated.length - 1)].id);
      return updated;
    });
  };

  const moveCell = (cellId: string, dir: "up" | "down") => {
    setCells(prev => {
      const idx = prev.findIndex(c => c.id === cellId);
      if (dir === "up" && idx === 0) return prev;
      if (dir === "down" && idx === prev.length - 1) return prev;
      const updated = [...prev];
      const t = dir === "up" ? idx - 1 : idx + 1;
      [updated[idx], updated[t]] = [updated[t], updated[idx]];
      return updated;
    });
  };

  const clearCellOutput = (cellId: string) => {
    setCells(prev => prev.map(c => c.id === cellId ? { ...c, outputs: [], executionCount: null } : c));
  };

  // ── Manual Save to DB ─────────────────────────────────────────────────────
  const handleSaveToDb = async () => {
    if (!onSaveCode || saveStatus === "saving") return;
    const serialized = serializeNotebook(cells);
    setSaveStatus("saving");
    try {
      const result = await onSaveCode(serialized);
      if (result.success) {
        setSaveStatus("saved");
        // Auto-reset to idle after 3s
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => setSaveStatus("unsaved"), 4000);
      }
    } catch {
      setSaveStatus("error");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaveStatus("unsaved"), 4000);
    }
  };

  // ── In-cell input provider ──────────────────────────────────────────────────
  const handleProvideInput = useCallback((cellId: string, value: string) => {
    setCells(prev => prev.map(c => {
      if (c.id === cellId && c.activeInput) {
        const resolve = c.activeInput.resolve;
        const promptText = c.activeInput.prompt;
        // Append both the prompt and user's answer into stdout to mirror terminal behavior
        const newStdout = `${promptText}${value}\n`;
        c.outputs.push({ type: "stdout", text: newStdout });
        c.activeInput = undefined;

        // Resolve input request out-of-band to prevent React hook collisions
        setTimeout(() => resolve(value), 0);

        return { ...c, outputs: [...c.outputs] };
      }
      return c;
    }));
  }, []);

  // ── Run a single cell ──────────────────────────────────────────────────────
  const runCell = useCallback(async (cellId: string) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell || !cell.code.trim() || cell.isRunning) return;

    setCells(prev => prev.map(c => c.id === cellId ? { ...c, isRunning: true, outputs: [], activeInput: undefined } : c));

    const outputs: OutputItem[] = [];
    let hasError = false;

    await runPythonCode(cell.code, {
      onStdout: (text) => {
        outputs.push({ type: "stdout", text });
        setCells(prev => prev.map(c => c.id === cellId ? { ...c, outputs: [...outputs] } : c));
      },
      onStderr: (text) => {
        hasError = true;
        outputs.push({ type: "stderr", text });
        setCells(prev => prev.map(c => c.id === cellId ? { ...c, outputs: [...outputs] } : c));
      },
      inputProvider: (promptText) => {
        return new Promise<string>((resolve) => {
          setCells(prev => prev.map(c => c.id === cellId ? { ...c, activeInput: { prompt: promptText || "Input: ", resolve } } : c));
        });
      }
    });

    globalExecCounter++;
    setCells(prev => prev.map(c =>
      c.id === cellId ? { ...c, isRunning: false, executionCount: globalExecCounter, outputs, activeInput: undefined } : c
    ));

    // Nudge user towards AI debug on error
    if (hasError) {
      toast({
        title: "⚠️ Error terdeteksi",
        description: "Klik 🐛 Debug untuk minta bantuan AI Chat.",
        duration: 3000,
      });
    }
  }, [cells, toast]);

  const runAllCells = async () => {
    for (const cell of cells) await runCell(cell.id);
  };

  // ── AI Generate (only feature that stays in-cell) ─────────────────────────
  const getAiKey = async (): Promise<string | null> => {
    const user = authService.getUser();
    if (!user) {
      toast({ title: "Belum login", description: "Login untuk pakai fitur AI.", variant: "destructive" });
      return null;
    }
    try {
      return await fetchUserApiKey(user.id);
    } catch {
      toast({ title: "API Key tidak ditemukan", description: "Tambahkan Gemini API key di Settings.", variant: "destructive" });
      return null;
    }
  };

  const handleAiGenerate = async (cellId: string, prompt: string) => {
    if (!prompt.trim()) return;
    const apiKey = await getAiKey();
    if (!apiKey) return;

    setCells(prev => prev.map(c => c.id === cellId ? { ...c, isAiLoading: true } : c));

    const genPrompt = `Buatkan kode Python untuk: ${prompt}\n\nBalas HANYA dengan blok kode python, tanpa penjelasan di luar code block:\n\`\`\`python\n# kode di sini\n\`\`\``;
    const messages = [{ role: "user" as const, content: genPrompt }];
    let fullText = "";
    const onChunk = (chunk: string) => { fullText += chunk; };

    try {
      await streamGeminiResponse(apiKey, messages, onChunk, new AbortController().signal);
    } catch {
      try {
        await streamGroqFallback(messages, onChunk, new AbortController().signal);
      } catch {
        toast({ title: "AI gagal generate kode", variant: "destructive" });
        setCells(prev => prev.map(c => c.id === cellId ? { ...c, isAiLoading: false } : c));
        return;
      }
    }

    const match = fullText.match(/```python\s*([\s\S]*?)```/);
    const extracted = match ? match[1].trim() : fullText.trim();

    setCells(prev => prev.map(c =>
      c.id === cellId ? { ...c, code: extracted, isAiLoading: false } : c
    ));
    toast({ title: "✨ Kode AI sudah siap!", description: "Klik ▶ untuk menjalankan.", duration: 2500 });
  };

  // ── Explain → kirim ke AI Chat ──────────────────────────────────────────────
  const handleExplain = (cellId: string) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell || !onSendToChat) return;
    const message = `📖 **Tolong jelaskan kode Python berikut** secara singkat dan mudah dipahami:\n\n\`\`\`python\n${cell.code}\n\`\`\``;
    onSendToChat(message);
    toast({ title: "📖 Explain dikirim ke AI Chat", description: "Lihat balasan di panel AI Chat.", duration: 2000 });
  };

  // ── Debug → kirim ke AI Chat ───────────────────────────────────────────────
  const handleDebug = (cellId: string) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell || !onSendToChat) return;
    const errorOutput = cell.outputs.filter(o => o.type === "stderr").map(o => o.text).join("\n");
    const message = errorOutput
      ? `🐛 **Tolong debug kode Python berikut** dan berikan solusi perbaikannya:\n\n**Kode:**\n\`\`\`python\n${cell.code}\n\`\`\`\n\n**Error:**\n\`\`\`\n${errorOutput}\n\`\`\``
      : `🐛 **Tolong periksa kode Python berikut** — ada kemungkinan bug atau masalah logika:\n\n\`\`\`python\n${cell.code}\n\`\`\``;
    onSendToChat(message);
    toast({ title: "🐛 Debug dikirim ke AI Chat", description: "Lihat analisis di panel AI Chat.", duration: 2000 });
  };

  // ── File import/export ─────────────────────────────────────────────────────
  const handleSave = () => {
    const allCode = cells.map((c, i) => `# === Cell ${i + 1} ===\n${c.code}`).join("\n\n");
    const blob = new Blob([allCode], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "notebook.py"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const parts = content.split(/^# === Cell \d+ ===/m).map(s => s.trim()).filter(Boolean);
      const newCells = parts.length > 0 ? parts.map(code => makeCell(code)) : [makeCell(content)];
      setCells(newCells);
      setActiveCell(newCells[0].id);
      onChange(newCells[0].code);
      toast({ title: "📂 File diimport!", description: `${file.name} → ${newCells.length} cell(s).`, duration: 2500 });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const monacoTheme = resolvedTheme === "dark" ? "nb-dark" : "nb-light";
  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 gap-2"
        style={{ background: isDark ? "#101014" : "#f8fafc" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
          </div>
          <span className="text-xs font-semibold text-foreground/80 font-mono truncate">notebook.ipynb</span>
          <span className="hidden sm:inline text-[10px] text-muted-foreground px-1.5 py-0.5 rounded border border-border bg-secondary">
            Python 3.10
          </span>
          {!isRuntimeReady && (
            <span className="text-[10px] text-amber-400 flex items-center gap-1 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading runtime…
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <input type="file" accept=".py" ref={fileInputRef} onChange={handleImport} className="hidden" />
          <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1">
            <Upload className="w-3.5 h-3.5" /><span className="hidden sm:inline">Import</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={handleSave}
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1">
            <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">.py</span>
          </Button>

          <div className="w-px h-4 bg-border mx-1" />

          {/* ── Save to DB button ── */}
          {onSaveCode && (
            <button
              onClick={handleSaveToDb}
              disabled={saveStatus === "saving" || saveStatus === "idle" || saveStatus === "saved"}
              title={
                saveStatus === "unsaved" ? "Simpan kode ke database"
                : saveStatus === "saving" ? "Menyimpan…"
                : saveStatus === "saved" ? "Tersimpan!"
                : saveStatus === "error" ? "Gagal simpan — klik untuk coba lagi"
                : "Kode belum diubah"
              }
              className={`h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 border transition-all duration-200 ${
                saveStatus === "unsaved"
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 cursor-pointer animate-pulse"
                  : saveStatus === "saving"
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-400 cursor-not-allowed"
                  : saveStatus === "saved"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 cursor-default"
                  : saveStatus === "error"
                  ? "border-red-500/60 bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer animate-pulse"
                  : "border-border/40 bg-secondary/30 text-muted-foreground/50 cursor-default"
              }`}
            >
              {saveStatus === "saving" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saveStatus === "saved" && <CheckCircle2 className="w-3.5 h-3.5" />}
              {saveStatus === "error" && <AlertCircle className="w-3.5 h-3.5" />}
              {(saveStatus === "idle" || saveStatus === "unsaved") && <Save className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {saveStatus === "saving" ? "Saving…"
                  : saveStatus === "saved" ? "Saved!"
                  : saveStatus === "error" ? "Retry"
                  : saveStatus === "unsaved" ? "Save"
                  : "Saved"}
              </span>
            </button>
          )}

          <div className="w-px h-4 bg-border mx-1" />
          <Button size="sm" variant="ghost" onClick={runAllCells} disabled={!isRuntimeReady}
            className="h-7 px-2.5 text-[11px] gap-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10">
            <Zap className="w-3.5 h-3.5" /><span className="hidden sm:inline">Run All</span>
          </Button>
          <Button size="sm" onClick={addCellAtEnd}
            className="h-7 px-2.5 text-[11px] gap-1 bg-violet-600 hover:bg-violet-500 text-white">
            <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Cell</span>
          </Button>
        </div>
      </div>

      {/* ── Cell List ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
        {cells.map((cell, idx) => (
          <CellCard
            key={cell.id}
            cell={cell}
            index={idx}
            totalCells={cells.length}
            isActive={activeCell === cell.id}
            monacoTheme={monacoTheme}
            isMobile={isMobile}
            isDark={isDark}
            isRuntimeReady={isRuntimeReady}
            hasChatHandler={!!onSendToChat}
            onActivate={() => setActiveCell(cell.id)}
            onCodeChange={(v) => handleCellCodeChange(cell.id, v)}
            onRun={() => runCell(cell.id)}
            onDelete={() => deleteCell(cell.id)}
            onMoveUp={() => moveCell(cell.id, "up")}
            onMoveDown={() => moveCell(cell.id, "down")}
            onAddBelow={() => addCellAfter(cell.id)}
            onClearOutput={() => clearCellOutput(cell.id)}
            onExplain={() => handleExplain(cell.id)}
            onDebug={() => handleDebug(cell.id)}
            onAiGenerate={(prompt) => handleAiGenerate(cell.id, prompt)}
            onEditorWillMount={handleEditorWillMount}
            onProvideInput={(val) => handleProvideInput(cell.id, val)}
          />
        ))}

        <button
          onClick={addCellAtEnd}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-violet-500/50 hover:bg-violet-500/5 transition-all duration-200 group"
        >
          <Plus className="w-3.5 h-3.5 group-hover:text-violet-400 transition-colors" />
          Add cell
        </button>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CellCard
// ─────────────────────────────────────────────────────────────────────────────

interface CellCardProps {
  cell: Cell;
  index: number;
  totalCells: number;
  isActive: boolean;
  monacoTheme: string;
  isMobile: boolean;
  isDark: boolean;
  isRuntimeReady: boolean;
  hasChatHandler: boolean;
  onActivate: () => void;
  onCodeChange: (v: string) => void;
  onRun: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddBelow: () => void;
  onClearOutput: () => void;
  onExplain: () => void;
  onDebug: () => void;
  onAiGenerate: (prompt: string) => void;
  onEditorWillMount: (monaco: any) => void;
  onProvideInput: (val: string) => void;
}

function CellCard({
  cell, index, totalCells, isActive, monacoTheme, isMobile, isDark, isRuntimeReady,
  hasChatHandler, onActivate, onCodeChange, onRun, onDelete, onMoveUp, onMoveDown,
  onAddBelow, onClearOutput, onExplain, onDebug, onAiGenerate, onEditorWillMount, onProvideInput
}: CellCardProps) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [isFolded, setIsFolded] = useState(false);

  const hasError = cell.outputs.some(o => o.type === "stderr");
  const hasOutput = cell.outputs.length > 0;
  const showOutputBox = hasOutput || !!cell.activeInput;

  const lineCount = Math.min(30, Math.max(3, cell.code.split("\n").length));
  const editorHeight = lineCount * (isMobile ? 20 : 22) + 32;

  return (
    <div
      onClick={onActivate}
      className={`relative group rounded-xl border transition-all duration-200 ${
        isActive
          ? isDark
            ? "border-violet-500/50 shadow-[0_0_0_1px_rgba(139,92,246,0.2)]"
            : "border-violet-400/60 shadow-[0_0_0_1px_rgba(139,92,246,0.15)]"
          : "border-border/50 hover:border-border"
      }`}
      style={{ background: isDark ? "#0d0d10" : "#fff" }}
    >
      {/* ── Cell header ───────────────────────────────────────────────────── */}
      <div 
        className={`flex items-center gap-2 px-2 py-1.5 border-b ${isFolded ? "border-transparent" : "border-border/30"} cursor-pointer hover:bg-secondary/20 transition-colors`}
        onClick={() => setIsFolded(!isFolded)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setIsFolded(!isFolded); }}
          title={isFolded ? "Unfold cell" : "Fold cell"}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          {isFolded ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Execution badge */}
        <div className={`shrink-0 w-8 h-6 rounded text-[10px] font-mono font-bold flex items-center justify-center border transition-colors ${
          cell.isRunning
            ? "border-amber-500/60 text-amber-400 bg-amber-500/10 animate-pulse"
            : cell.executionCount !== null
            ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
            : "border-border/40 text-muted-foreground/50 bg-secondary/30"
        }`}>
          {cell.isRunning
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : cell.executionCount !== null ? `[${cell.executionCount}]` : "[ ]"}
        </div>

        {/* Run button */}
        <button
          onClick={(e) => { e.stopPropagation(); onRun(); }}
          disabled={!isRuntimeReady || cell.isRunning}
          title="Run cell (Ctrl+Enter)"
          className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-150 ${
            cell.isRunning
              ? "border-amber-500/40 bg-amber-500/10 text-amber-400 cursor-not-allowed"
              : isRuntimeReady
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/70 hover:shadow-[0_0_8px_rgba(52,211,153,0.3)]"
              : "border-border/30 text-muted-foreground cursor-not-allowed"
          }`}
        >
          {cell.isRunning
            ? <Square className="w-3.5 h-3.5" />
            : <Play className="w-3.5 h-3.5 translate-x-px" />}
        </button>

        {/* Cell label & Preview */}
        <span className="text-[10px] text-muted-foreground font-mono flex-1 truncate hidden sm:flex items-center gap-2">
          Cell {index + 1}
          {cell.isAiLoading && <span className="text-violet-400 animate-pulse">AI generating…</span>}
          {isFolded && cell.code && (
            <span className="text-muted-foreground/50 border-l border-border/50 pl-2 pointer-events-none">
              {cell.code.split('\n')[0].substring(0, 60)}{cell.code.length > 60 ? '...' : ''}
            </span>
          )}
        </span>

        {/* Action buttons — visible on hover / active */}
        <div className={`flex items-center gap-0.5 transition-opacity duration-150 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>

          {/* ✨ AI Generate */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowAiPrompt(v => !v); }}
            title="AI: Buat kode dari deskripsi"
            className={`h-6 px-1.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
              showAiPrompt
                ? "bg-violet-500/15 text-violet-400"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">AI Generate</span>
          </button>

          {/* 📖 Explain → AI Chat */}
          {hasChatHandler && (
            <button
              onClick={(e) => { e.stopPropagation(); onExplain(); }}
              title="Jelaskan kode ini di AI Chat"
              className="h-6 px-1.5 rounded text-[10px] font-medium flex items-center gap-1 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-400 transition-colors"
            >
              <BookOpen className="w-3 h-3" />
              <span className="hidden sm:inline">Explain</span>
            </button>
          )}

          {/* 🐛 Debug → AI Chat */}
          {hasChatHandler && (
            <button
              onClick={(e) => { e.stopPropagation(); onDebug(); }}
              title="Debug kode ini di AI Chat"
              className={`h-6 px-1.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
                hasError
                  ? "text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 animate-pulse"
                  : "text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
              }`}
            >
              <Bug className="w-3 h-3" />
              <span className="hidden sm:inline">Debug</span>
            </button>
          )}

          <div className="w-px h-3.5 bg-border/50 mx-0.5" />

          {/* Move up */}
          <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={index === 0}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 transition-colors">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Move down */}
          <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={index === totalCells - 1}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 transition-colors">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Delete */}
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-red-500/15 hover:text-red-400 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── AI Generate prompt bar ─────────────────────────────────────────── */}
      {showAiPrompt && (
        <div
          className="px-2 py-1.5 border-b border-border/30 bg-violet-500/5 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <input
            autoFocus
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && aiPrompt.trim()) {
                onAiGenerate(aiPrompt);
                setAiPrompt("");
                setShowAiPrompt(false);
              }
              if (e.key === "Escape") setShowAiPrompt(false);
            }}
            placeholder="Deskripsikan kode yang ingin dibuat… (Enter untuk generate)"
            className="flex-1 bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground/60"
          />
          <button onClick={() => setShowAiPrompt(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Monaco Editor ──────────────────────────────────────────────────── */}
      {!isFolded && (
        <div
          style={{ height: editorHeight }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); onRun(); }
          }}
        >
          <Editor
            height={editorHeight}
            defaultLanguage="python"
            value={cell.code}
            onChange={(v) => onCodeChange(v ?? "")}
            theme={monacoTheme}
            beforeMount={onEditorWillMount}
            options={{
              minimap: { enabled: false },
              fontSize: isMobile ? 12 : 13,
              fontFamily: "JetBrains Mono, Fira Code, monospace",
              lineHeight: isMobile ? 20 : 22,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              padding: { top: 8, bottom: 8 },
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              wordWrap: "on",
              scrollbar: { vertical: "hidden", horizontal: "auto" },
              overviewRulerLanes: 0,
            }}
          />
        </div>
      )}

      {/* ── Output ────────────────────────────────────────────────────────── */}
      {!isFolded && showOutputBox && (
        <div className="border-t border-border/30">
          <div className="flex items-center justify-between px-3 py-1 bg-secondary/20">
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
              Output{hasError && (
                <span className="text-red-400 ml-2 normal-case">
                  ⚠ Error — klik <strong>Debug</strong> untuk bantuan AI
                </span>
              )}
              {cell.activeInput && (
                <span className="text-indigo-400 ml-2 normal-case animate-pulse inline-flex items-center gap-1">
                  Menunggu input Anda...
                </span>
              )}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClearOutput(); }}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
          <div className="px-3 py-2 max-h-60 overflow-y-auto font-mono text-xs leading-relaxed flex flex-col gap-0.5">
            {cell.outputs.map((out, i) => (
              <div key={i} className={
                out.type === "stderr"
                  ? "text-red-400 whitespace-pre-wrap"
                  : "text-foreground/90 whitespace-pre-wrap"
              }>
                {out.text}
              </div>
            ))}
            
            {/* Native In-Cell Input Field */}
            {cell.activeInput && (
              <div className="flex items-center font-mono mt-1 pt-1">
                <span className="whitespace-pre text-indigo-400/90 font-medium">{cell.activeInput.prompt}</span>
                <input
                  type="text"
                  autoFocus
                  className="flex-1 bg-transparent min-w-[50px] outline-none border-b border-indigo-500/30 focus:border-indigo-500/70 rounded-none px-1 py-0.5 text-emerald-400/90 ml-1 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onProvideInput(e.currentTarget.value);
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add cell below (hover button) ─────────────────────────────────── */}
      <div className={`absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-10 transition-opacity duration-150 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <button
          onClick={(e) => { e.stopPropagation(); onAddBelow(); }}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-background border border-border text-[10px] text-muted-foreground hover:text-violet-400 hover:border-violet-500/50 shadow-sm transition-all"
        >
          <Plus className="w-3 h-3" /> cell
        </button>
      </div>
    </div>
  );
}
