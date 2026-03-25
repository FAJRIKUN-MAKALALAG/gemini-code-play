import { useRef, useState, useEffect, useCallback } from "react";
import { Editor } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import {
  Play, Loader2, Plus, Trash2, ChevronUp, ChevronDown,
  Sparkles, Bug, BookOpen, Download, Upload, X, Zap,
  Square, GripVertical
} from "lucide-react";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { fetchUserApiKey, streamGeminiResponse } from "@/services/geminiService";
import { streamGroqFallback } from "@/services/groqFallbackService";
import { runPythonCode } from "@/utils/skulptRunner";
import { v4 as uuidv4 } from "uuid";

// ── Types ─────────────────────────────────────────────────────────────────────

type OutputItem =
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "ai"; text: string }
  | { type: "info"; text: string };

interface Cell {
  id: string;
  code: string;
  outputs: OutputItem[];
  executionCount: number | null;
  isRunning: boolean;
  isAiLoading: boolean;
  // which AI panel is open for this cell: null | "explain" | "debug"
  aiPanel: null | "explain" | "debug";
  aiOutput: string;
}

interface NotebookEditorProps {
  /** Current code of the first cell (for external sync / saving) */
  code: string;
  onChange: (value: string) => void;
  /** Called when the user asks the AI chat to handle something */
  onSendToChat?: (message: string) => void;
  isRuntimeReady?: boolean;
}

// ── Global execution counter (shared across cells) ────────────────────────────
let globalExecCounter = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCell(code = ""): Cell {
  return {
    id: uuidv4(),
    code,
    outputs: [],
    executionCount: null,
    isRunning: false,
    isAiLoading: false,
    aiPanel: null,
    aiOutput: "",
  };
}

function AIBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-violet-500/15 text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded-full">
      <Sparkles className="w-2.5 h-2.5" /> {label}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export const NotebookEditor = ({
  code,
  onChange,
  onSendToChat,
  isRuntimeReady = true,
}: NotebookEditorProps) => {
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // ── State ──────────────────────────────────────────────────────────────────
  const [cells, setCells] = useState<Cell[]>(() => [makeCell(code)]);
  const [activeCell, setActiveCell] = useState<string>(cells[0].id);

  // Sync first cell code when external `code` prop changes
  // (e.g. AI loads code into editor from chat)
  const lastExternalCode = useRef(code);
  useEffect(() => {
    if (code !== lastExternalCode.current) {
      lastExternalCode.current = code;
      setCells(prev => {
        const updated = [...prev];
        updated[0] = { ...updated[0], code };
        return updated;
      });
    }
  }, [code]);

  // Sync first cell back to parent when it changes
  const handleCellCodeChange = useCallback(
    (cellId: string, value: string) => {
      setCells(prev => {
        const updated = prev.map(c => c.id === cellId ? { ...c, code: value } : c);
        const firstCell = updated.find(c => c.id === cells[0].id) ?? updated[0];
        if (firstCell) {
          lastExternalCode.current = firstCell.code;
          onChange(firstCell.code);
        }
        return updated;
      });
    },
    [cells, onChange]
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Monaco theme setup ─────────────────────────────────────────────────────
  const handleEditorWillMount = (monaco: any) => {
    if (monaco.editor.getModel(monaco.Uri.parse("custom://dark"))) return;
    monaco.editor.defineTheme("nb-dark", {
      base: "vs-dark",
      inherit: true,
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
      base: "vs",
      inherit: true,
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
    return newCell.id;
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
      const newActive = updated[Math.min(idx, updated.length - 1)];
      setActiveCell(newActive.id);
      return updated;
    });
  };

  const moveCell = (cellId: string, direction: "up" | "down") => {
    setCells(prev => {
      const idx = prev.findIndex(c => c.id === cellId);
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === prev.length - 1) return prev;
      const updated = [...prev];
      const target = direction === "up" ? idx - 1 : idx + 1;
      [updated[idx], updated[target]] = [updated[target], updated[idx]];
      return updated;
    });
  };

  const clearCellOutput = (cellId: string) => {
    setCells(prev =>
      prev.map(c => c.id === cellId ? { ...c, outputs: [], executionCount: null } : c)
    );
  };

  // ── Run a single cell ──────────────────────────────────────────────────────
  const runCell = useCallback(async (cellId: string) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell || !cell.code.trim() || cell.isRunning) return;

    setCells(prev => prev.map(c =>
      c.id === cellId ? { ...c, isRunning: true, outputs: [] } : c
    ));

    const outputs: OutputItem[] = [];
    let hasError = false;
    let errorText = "";

    await runPythonCode(cell.code, {
      onStdout: (text) => {
        outputs.push({ type: "stdout", text });
        setCells(prev => prev.map(c =>
          c.id === cellId ? { ...c, outputs: [...outputs] } : c
        ));
      },
      onStderr: (text) => {
        hasError = true;
        errorText += text;
        outputs.push({ type: "stderr", text });
        setCells(prev => prev.map(c =>
          c.id === cellId ? { ...c, outputs: [...outputs] } : c
        ));
      },
    });

    globalExecCounter++;
    const execCount = globalExecCounter;

    setCells(prev => prev.map(c =>
      c.id === cellId
        ? { ...c, isRunning: false, executionCount: execCount, outputs }
        : c
    ));

    // Auto-open debug panel if there's an error
    if (hasError) {
      toast({
        title: "⚠️ Error terdeteksi",
        description: "Klik 🐛 Auto Debug untuk minta AI membantu.",
        duration: 3000,
      });
    }
  }, [cells, toast]);

  // ── Run all cells in order ─────────────────────────────────────────────────
  const runAllCells = async () => {
    for (const cell of cells) {
      await runCell(cell.id);
    }
  };

  // ── AI helpers ─────────────────────────────────────────────────────────────
  const getAiKey = async (): Promise<string | null> => {
    const user = authService.getUser();
    if (!user) {
      toast({ title: "Belum login", description: "Login dulu untuk pakai fitur AI.", variant: "destructive" });
      return null;
    }
    const token = authService.getAccessToken() ?? "";
    try {
      return await fetchUserApiKey(user.id, token);
    } catch {
      toast({ title: "API Key tidak ditemukan", description: "Tambahkan Gemini API key di Settings.", variant: "destructive" });
      return null;
    }
  };

  const streamAiResponse = async (
    prompt: string,
    cellId: string,
    panelType: "explain" | "debug"
  ) => {
    const apiKey = await getAiKey();
    if (!apiKey) return;

    setCells(prev => prev.map(c =>
      c.id === cellId ? { ...c, isAiLoading: true, aiPanel: panelType, aiOutput: "" } : c
    ));

    const messages = [{ role: "user" as const, content: prompt }];
    let fullText = "";

    const onChunk = (chunk: string) => {
      fullText += chunk;
      setCells(prev => prev.map(c =>
        c.id === cellId ? { ...c, aiOutput: fullText } : c
      ));
    };

    try {
      // Try Gemini first, fall back to Groq
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 25_000);
      try {
        await streamGeminiResponse(apiKey, messages, onChunk, controller.signal);
        clearTimeout(timer);
      } catch {
        clearTimeout(timer);
        if (timedOut) {
          fullText = "";
          setCells(prev => prev.map(c => c.id === cellId ? { ...c, aiOutput: "" } : c));
          await streamGroqFallback(messages, onChunk, new AbortController().signal);
        } else throw new Error("AI error");
      }
    } catch (e) {
      setCells(prev => prev.map(c =>
        c.id === cellId
          ? { ...c, aiOutput: "❌ Gagal mendapatkan respons AI. Coba lagi.", isAiLoading: false }
          : c
      ));
      return;
    }

    setCells(prev => prev.map(c =>
      c.id === cellId ? { ...c, isAiLoading: false } : c
    ));
  };

  const handleExplain = async (cellId: string) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell) return;
    if (cell.aiPanel === "explain" && !cell.isAiLoading) {
      // toggle off
      setCells(prev => prev.map(c => c.id === cellId ? { ...c, aiPanel: null, aiOutput: "" } : c));
      return;
    }
    const prompt = `Jelaskan kode Python berikut secara singkat dan mudah dipahami untuk pemula. Gunakan bahasa Indonesia dan format markdown.\n\n\`\`\`python\n${cell.code}\n\`\`\``;
    await streamAiResponse(prompt, cellId, "explain");
  };

  const handleDebug = async (cellId: string) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell) return;
    if (cell.aiPanel === "debug" && !cell.isAiLoading) {
      setCells(prev => prev.map(c => c.id === cellId ? { ...c, aiPanel: null, aiOutput: "" } : c));
      return;
    }
    const errorOutput = cell.outputs.filter(o => o.type === "stderr").map(o => o.text).join("\n");
    const prompt = `Kode Python berikut menghasilkan error. Tolong identifikasi penyebab error dan berikan solusi perbaikannya. Gunakan bahasa Indonesia dan format markdown.\n\n**Kode:**\n\`\`\`python\n${cell.code}\n\`\`\`\n\n**Error:**\n\`\`\`\n${errorOutput || "(tidak ada output error, tapi ada masalah logika)"}\n\`\`\``;
    await streamAiResponse(prompt, cellId, "debug");
  };

  const handleAiGenerateToCell = async (cellId: string, prompt: string) => {
    if (!prompt.trim()) return;
    const genPrompt = `Buatkan kode Python untuk: ${prompt}\n\nBalas HANYA dengan blok kode python saja, tanpa penjelasan tambahan di luar code block. Gunakan format:\n\`\`\`python\n# kode di sini\n\`\`\``;
    const apiKey = await getAiKey();
    if (!apiKey) return;

    setCells(prev => prev.map(c =>
      c.id === cellId ? { ...c, isAiLoading: true } : c
    ));

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

    // Extract code from markdown block
    const match = fullText.match(/```python\s*([\s\S]*?)```/);
    const extracted = match ? match[1].trim() : fullText.trim();

    setCells(prev => prev.map(c =>
      c.id === cellId ? { ...c, code: extracted, isAiLoading: false } : c
    ));
    toast({ title: "✨ Kode AI sudah siap!", description: "Klik ▶ untuk menjalankan.", duration: 2500 });
  };

  // ── File import/export ─────────────────────────────────────────────────────
  const handleSaveNotebook = () => {
    const allCode = cells.map((c, i) => `# === Cell ${i + 1} ===\n${c.code}`).join("\n\n");
    const blob = new Blob([allCode], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notebook.py";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      // Split on cell separator comment or just make single cell
      const parts = content.split(/^# === Cell \d+ ===/m).map(s => s.trim()).filter(Boolean);
      const newCells = parts.length > 0
        ? parts.map(code => makeCell(code))
        : [makeCell(content)];
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
    <div className="flex flex-col h-full bg-background overflow-hidden" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* ── Notebook Toolbar ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 gap-2"
        style={{ background: isDark ? "#101014" : "#f8fafc" }}
      >
        {/* Left: title & badges */}
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

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          <input type="file" accept=".py" ref={fileInputRef} onChange={handleImport} className="hidden" />
          <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1">
            <Upload className="w-3.5 h-3.5" /><span className="hidden sm:inline">Import</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={handleSaveNotebook}
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1">
            <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Save</span>
          </Button>
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

      {/* ── Cell List ─────────────────────────────────────────────────────── */}
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
            onAiGenerate={(prompt) => handleAiGenerateToCell(cell.id, prompt)}
            onSendToChat={onSendToChat}
            onEditorWillMount={handleEditorWillMount}
          />
        ))}

        {/* Add cell footer button */}
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
};

// ─────────────────────────────────────────────────────────────────────────────
// CellCard — individual notebook cell
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
  onSendToChat?: (msg: string) => void;
  onEditorWillMount: (monaco: any) => void;
}

function CellCard({
  cell, index, totalCells, isActive, monacoTheme, isMobile, isDark, isRuntimeReady,
  onActivate, onCodeChange, onRun, onDelete, onMoveUp, onMoveDown, onAddBelow,
  onClearOutput, onExplain, onDebug, onAiGenerate, onSendToChat, onEditorWillMount,
}: CellCardProps) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const hasError = cell.outputs.some(o => o.type === "stderr");
  const hasOutput = cell.outputs.length > 0;

  // Calculate editor height based on number of lines (min 3, max 30)
  const lineCount = Math.min(30, Math.max(3, cell.code.split("\n").length));
  const editorHeight = lineCount * (isMobile ? 20 : 22) + 32;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onRun();
    }
  };

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
      {/* Cell header: execution count + run button + cell actions */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/30">
        {/* Execution badge */}
        <div
          className={`shrink-0 w-8 h-6 rounded text-[10px] font-mono font-bold flex items-center justify-center border transition-colors ${
            cell.isRunning
              ? "border-amber-500/60 text-amber-400 bg-amber-500/10 animate-pulse"
              : cell.executionCount !== null
              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
              : "border-border/40 text-muted-foreground/50 bg-secondary/30"
          }`}
        >
          {cell.isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : cell.executionCount !== null ? `[${cell.executionCount}]` : "[ ]"}
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

        {/* Cell label */}
        <span className="text-[10px] text-muted-foreground font-mono flex-1 truncate hidden sm:block">
          Cell {index + 1}
          {cell.isAiLoading && <span className="ml-2 text-violet-400 animate-pulse">AI working…</span>}
        </span>

        {/* Right-side actions (only visible on hover/active) */}
        <div className={`flex items-center gap-0.5 transition-opacity duration-150 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          {/* AI Generate */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowAiPrompt(v => !v); }}
            title="AI: Generate code"
            className="h-6 px-1.5 rounded text-[10px] font-medium text-violet-400 hover:bg-violet-400/10 flex items-center gap-1 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">AI Generate</span>
          </button>

          {/* Explain */}
          <button
            onClick={(e) => { e.stopPropagation(); onExplain(); }}
            title="AI: Explain code"
            className={`h-6 px-1.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
              cell.aiPanel === "explain" ? "bg-blue-500/15 text-blue-400" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <BookOpen className="w-3 h-3" />
            <span className="hidden sm:inline">Explain</span>
          </button>

          {/* Debug */}
          <button
            onClick={(e) => { e.stopPropagation(); onDebug(); }}
            title="AI: Debug code"
            className={`h-6 px-1.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
              cell.aiPanel === "debug" ? "bg-red-500/15 text-red-400" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            } ${hasError ? "text-red-400 animate-pulse" : ""}`}
          >
            <Bug className="w-3 h-3" />
            <span className="hidden sm:inline">Debug</span>
          </button>

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

      {/* AI Prompt input (for generate) */}
      {showAiPrompt && (
        <div className="px-2 py-1.5 border-b border-border/30 bg-violet-500/5 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}>
          <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <input
            autoFocus
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onAiGenerate(aiPrompt);
                setAiPrompt("");
                setShowAiPrompt(false);
              }
              if (e.key === "Escape") setShowAiPrompt(false);
            }}
            placeholder='Deskripsikan kode yang ingin dibuat… (Enter untuk generate)'
            className="flex-1 bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground/60"
          />
          <button onClick={() => setShowAiPrompt(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Monaco editor */}
      <div onKeyDown={handleKeyDown} style={{ height: editorHeight }}>
        <Editor
          height={editorHeight}
          defaultLanguage="python"
          value={cell.code}
          onChange={(v) => onCodeChange(v ?? "")}
          theme={monacoTheme}
          beforeMount={onEditorWillMount}
          onMount={(editor) => {
            // Prevent editor click from bubbling to cell card
          }}
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

      {/* Output area */}
      {hasOutput && (
        <div className="border-t border-border/30">
          <div className="flex items-center justify-between px-3 py-1 bg-secondary/20">
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
              Output {hasError && <span className="text-red-400 ml-1">⚠ Error</span>}
            </span>
            <button onClick={(e) => { e.stopPropagation(); onClearOutput(); }}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
          <div className="px-3 py-2 max-h-60 overflow-y-auto font-mono text-xs leading-relaxed">
            {cell.outputs.map((out, i) => (
              <div key={i} className={
                out.type === "stderr"
                  ? "text-red-400 whitespace-pre-wrap"
                  : out.type === "ai"
                  ? "text-violet-300 whitespace-pre-wrap"
                  : out.type === "info"
                  ? "text-blue-400 whitespace-pre-wrap"
                  : "text-foreground/90 whitespace-pre-wrap"
              }>
                {out.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI output panel (explain / debug) */}
      {cell.aiPanel && (
        <div className={`border-t ${cell.aiPanel === "debug" ? "border-red-500/20" : "border-blue-500/20"}`}>
          <div className={`flex items-center justify-between px-3 py-1.5 ${
            cell.aiPanel === "debug" ? "bg-red-500/5" : "bg-blue-500/5"
          }`}>
            <AIBadge label={cell.aiPanel === "debug" ? "🐛 Auto Debug" : "📖 Explain"} />
            {cell.isAiLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />}
            <button
              onClick={(e) => { e.stopPropagation(); /* close */ }}
              className="text-muted-foreground hover:text-foreground ml-auto"
            >
            </button>
          </div>
          <div className="px-3 py-2 max-h-72 overflow-y-auto">
            <AiOutputRenderer text={cell.aiOutput} isLoading={cell.isAiLoading} onSendToChat={onSendToChat} code={cell.code} />
          </div>
        </div>
      )}

      {/* Add cell below button (shows on hover) */}
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

// ─────────────────────────────────────────────────────────────────────────────
// AI Output Renderer — simple markdown-aware renderer for AI text
// ─────────────────────────────────────────────────────────────────────────────

function AiOutputRenderer({
  text, isLoading, onSendToChat, code
}: { text: string; isLoading: boolean; onSendToChat?: (msg: string) => void; code: string }) {
  if (!text && isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
        <span>AI sedang menganalisis…</span>
      </div>
    );
  }

  if (!text) return null;

  // Simple text with code block highlighting (no heavy MD library)
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="text-xs leading-relaxed space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.replace(/^```\w*\n?/, "").replace(/```$/, "");
          return (
            <div key={i} className="rounded-lg overflow-hidden border border-zinc-700/60 my-1">
              <div className="bg-zinc-800 px-3 py-1 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">python</div>
              <pre className="bg-[#1e1e1e] px-3 py-2 text-xs font-mono text-[#c3e88d] overflow-x-auto whitespace-pre-wrap">{lines}</pre>
            </div>
          );
        }
        // Bold
        const formatted = part.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        return <p key={i} className="text-foreground/80 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatted }} />;
      })}

      {/* Send to AI Chat button */}
      {onSendToChat && !isLoading && (
        <button
          onClick={() => onSendToChat(`Tolong jelaskan lebih lanjut dan bantu saya perbaiki kode ini:\n\`\`\`python\n${code}\n\`\`\``)}
          className="mt-2 flex items-center gap-1.5 text-[10px] text-violet-400 hover:text-violet-300 border border-violet-500/30 hover:border-violet-500/60 bg-violet-500/5 hover:bg-violet-500/10 px-2 py-1 rounded-lg transition-all"
        >
          <Sparkles className="w-3 h-3" /> Diskusikan di AI Chat
        </button>
      )}
    </div>
  );
}
