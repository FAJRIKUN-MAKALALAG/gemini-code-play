import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Editor } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import {
  Play, Loader2, Plus, Trash2, ChevronUp, ChevronDown, ChevronRight,
  Sparkles, Bug, BookOpen, Download, Upload, X, Zap, Square,
  Save, Share, CheckCircle2, AlertCircle, Target, Sparkles as SparklesIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/ThemeProvider";
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
  isVerifying?: boolean; // for challenge validation
  activeInput?: { prompt: string; resolve: (val: string) => void };
  abortController?: AbortController;
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
  /** Sends a user message to the AI Chat sidebar (triggers Gemini) */
  onSendToChat?: (message: string) => void;
  /** Sends AI result directly as assistant message — isPass=true membuka AI chat setelah tantangan lulus */
  onSendAIResult?: (message: string, usage?: { inputTokens: number; outputTokens: number }, isPass?: boolean) => void;
  /** Called when user clicks Save — should persist code to DB */
  onSaveCode?: (code: string) => Promise<{ success: boolean; id?: string }>;
  isRuntimeReady?: boolean;
  disableAI?: boolean;
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
    onSendAIResult,
    onSaveCode,
    isRuntimeReady = true,
    disableAI = false,
  },
  ref
) => {
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isGeneratingChallenge, setIsGeneratingChallenge] = useState(false);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [customTopic, setCustomTopic] = useState("");

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

  const syncSetCells = useCallback((updater: (prev: Cell[]) => Cell[]) => {
    setCells(prev => {
      const next = updater(prev);
      const serialized = serializeNotebook(next);
      if (serialized !== lastExternalCode.current) {
        lastExternalCode.current = serialized;
        onChange(serialized);
        setSaveStatus("unsaved");
      }
      return next;
    });
  }, [onChange]);

  const handleCellCodeChange = useCallback(
    (cellId: string, value: string) => {
      syncSetCells(prev => prev.map(c => c.id === cellId ? { ...c, code: value } : c));
    },
    [syncSetCells]
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
    syncSetCells(prev => {
      const idx = prev.findIndex(c => c.id === cellId);
      const updated = [...prev];
      updated.splice(idx + 1, 0, newCell);
      return updated;
    });
    setActiveCell(newCell.id);
  };

  const addCellAtEnd = () => {
    const newCell = makeCell();
    syncSetCells(prev => [...prev, newCell]);
    setActiveCell(newCell.id);
  };

  const deleteCell = (cellId: string) => {
    syncSetCells(prev => {
      if (prev.length === 1) return [makeCell()];
      const idx = prev.findIndex(c => c.id === cellId);
      const updated = prev.filter(c => c.id !== cellId);
      setActiveCell(updated[Math.min(idx, updated.length - 1)].id);
      return updated;
    });
  };

  const moveCell = (cellId: string, dir: "up" | "down") => {
    syncSetCells(prev => {
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

  const handleShare = async () => {
    if (!onSaveCode) return;
    const serialized = serializeNotebook(cells);
    setSaveStatus("saving");
    try {
      const result = await onSaveCode(serialized);
      if (result.success && result.id) {
        setSaveStatus("saved");
        const shareUrl = `${window.location.origin}/share/${result.id}`;
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "🔗 Link Tersalin!",
          description: "Link pengerjaan kamu sudah dikopi ke clipboard. Bagikan ke temanmu!",
          duration: 4000,
        });
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
        toast({ title: "Gagal membagikan link", variant: "destructive" });
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => setSaveStatus("unsaved"), 4000);
      }
    } catch {
      setSaveStatus("error");
      toast({ title: "Gagal membagikan link", variant: "destructive" });
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
        const newOutputs = [...c.outputs];
        if (newOutputs.length > 0 && newOutputs[newOutputs.length - 1].type === "stdout") {
          newOutputs[newOutputs.length - 1] = { type: "stdout", text: newOutputs[newOutputs.length - 1].text + newStdout };
        } else {
          newOutputs.push({ type: "stdout", text: newStdout });
        }
        c.activeInput = undefined;

        // Resolve input request out-of-band to prevent React hook collisions
        setTimeout(() => resolve(value), 0);

        return { ...c, outputs: newOutputs };
      }
      return c;
    }));
  }, []);

  // ── Run a single cell ──────────────────────────────────────────────────────
  const runCell = useCallback(async (cellId: string) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell || !cell.code.trim() || cell.isRunning) return;

    const abortController = new AbortController();

    setCells(prev => prev.map(c => c.id === cellId ? { ...c, isRunning: true, outputs: [], activeInput: undefined, abortController } : c));

    const outputs: OutputItem[] = [];
    let hasError = false;

    await runPythonCode(cell.code, {
      signal: abortController.signal,
      onStdout: (text) => {
        if (outputs.length > 0 && outputs[outputs.length - 1].type === "stdout") {
          outputs[outputs.length - 1] = { type: "stdout", text: outputs[outputs.length - 1].text + text };
        } else {
          outputs.push({ type: "stdout", text });
        }
        setCells(prev => prev.map(c => c.id === cellId ? { ...c, outputs: [...outputs] } : c));
      },
      onStderr: (text) => {
        hasError = true;
        if (outputs.length > 0 && outputs[outputs.length - 1].type === "stderr") {
          outputs[outputs.length - 1] = { type: "stderr", text: outputs[outputs.length - 1].text + text };
        } else {
          outputs.push({ type: "stderr", text });
        }
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
      c.id === cellId ? { ...c, isRunning: false, executionCount: globalExecCounter, outputs, activeInput: undefined, abortController: undefined } : c
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

  const stopCell = useCallback((cellId: string) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell || !cell.isRunning) return;

    if (cell.activeInput) {
      cell.activeInput.resolve(""); // Unblock prompt
    }

    if (cell.abortController) {
      cell.abortController.abort();
    }
  }, [cells]);

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

  // ── Helper: tampilkan token usage toast ──────────────────────────────────
  const showTokenToast = (inputTokens: number, outputTokens: number, label: string) => {
    if (inputTokens === 0 && outputTokens === 0) return; // skip jika tidak ada data
    toast({
      title: `⚡ ${label} — Token dipakai`,
      description: `Input: ${inputTokens.toLocaleString()} tok · Output: ${outputTokens.toLocaleString()} tok · Total: ${(inputTokens + outputTokens).toLocaleString()} tok`,
      duration: 3500,
    });
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

    let inputTokens = 0, outputTokens = 0;
    try {
      const result = await streamGeminiResponse(apiKey, messages, onChunk, new AbortController().signal);
      fullText = result.fullText;
      inputTokens = result.usage.inputTokens;
      outputTokens = result.usage.outputTokens;
    } catch {
      try {
        fullText = await streamGroqFallback(messages, onChunk, new AbortController().signal);
      } catch {
        toast({ title: "AI gagal generate kode", variant: "destructive" });
        setCells(prev => prev.map(c => c.id === cellId ? { ...c, isAiLoading: false } : c));
        return;
      }
    }

    const match = fullText.match(/```python\s*([\s\S]*?)```/);
    const extracted = match ? match[1].trim() : fullText.trim();

    syncSetCells(prev => prev.map(c =>
      c.id === cellId ? { ...c, code: extracted, isAiLoading: false } : c
    ));
    toast({ title: "✨ Kode AI sudah siap!", description: "Klik ▶ untuk menjalankan.", duration: 2500 });
    showTokenToast(inputTokens, outputTokens, "AI Generate");
  };

  // ── 🎯 AI Challenge Generator ────────────────────────────────────────────────
  const handleGenerateChallenge = async () => {
    const apiKey = await getAiKey();
    if (!apiKey) return;

    setShowChallengeDialog(false);
    setIsGeneratingChallenge(true);
    toast({ title: "⏳ Membuat soal latihan...", description: "Mohon tunggu sebentar.", duration: 2500 });

    // Create an empty cell first to show loading
    const newCell = makeCell();
    newCell.isAiLoading = true;
    setCells((prev) => [...prev, newCell]);
    setActiveCell(newCell.id);

    const topicDesc = customTopic.trim() 
      ? `berfokus pada "${customTopic.trim()}"` 
      : "dengan topik random (Variabel, Looping, Function, List, atau Dictionary)";

    const prompt = `Berikan 1 soal tantangan ngoding Python untuk latihan mahasiswa ${topicDesc}.
Aturan:
1. Soal harus mendidik dan menantang sesuai level pemula/menengah.
2. JANGAN BERIKAN JAWABAN ATAU KODE SOLUSINYA SAMA SEKALI. Teks harus murni soal/instruksi.
3. Awali dengan tepat tulisan ini (WAJIB): "# 🎯 TANTANGAN: ${customTopic.trim() || "Python Practice"}" lalu berikan spasi/enter.
4. Tulis deskripsi soal di dalam format komentar Python (diawali tanda #).
5. Diakhiri dengan "# Tulis kodemu di bawah ini:"`;

    const messages = [{ role: "user" as const, content: prompt }];
    let fullText = "";
    const onChunk = (chunk: string) => { fullText += chunk; };

    let inputTokens = 0, outputTokens = 0;
    try {
      const result = await streamGeminiResponse(apiKey, messages, onChunk, new AbortController().signal);
      fullText = result.fullText;
      inputTokens = result.usage.inputTokens;
      outputTokens = result.usage.outputTokens;
    } catch {
      try {
        fullText = await streamGroqFallback(messages, onChunk, new AbortController().signal);
      } catch {
        toast({ title: "Gagal membuat soal", variant: "destructive" });
        setCells(prev => prev.filter(c => c.id !== newCell.id));
        setIsGeneratingChallenge(false);
        return;
      }
    }

    // Clean up markdown block if the AI returned it
    const match = fullText.match(/```python\s*([\s\S]*?)```/);
    const extracted = match ? match[1].trim() : fullText.trim();

    syncSetCells(prev => prev.map(c =>
      c.id === newCell.id ? { ...c, code: extracted + "\n\n", isAiLoading: false } : c
    ));
    setIsGeneratingChallenge(false);
    toast({ title: "🎯 Soal latihan siap!", description: "Kerjakan secara mandiri di cell tersebut.", duration: 3000 });
    showTokenToast(inputTokens, outputTokens, "Latihan Cepat");
  };

  // ── Explain → langsung call Gemini, hasil tampil di AI Chat sebagai pesan AI ─
  const handleExplain = async (cellId: string) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell || !onSendAIResult) return;

    const apiKey = await getAiKey();
    if (!apiKey) return;

    setCells(prev => prev.map(c => c.id === cellId ? { ...c, isAiLoading: true } : c));
    toast({ title: "📖 Menjelaskan kode...", description: "AI sedang menganalisis kodemu.", duration: 2000 });

    const prompt = `📖 **Tolong jelaskan kode Python berikut** secara singkat dan mudah dipahami:\n\n\`\`\`python\n${cell.code}\n\`\`\``;
    const messages = [{ role: "user" as const, content: prompt }];
    let resultText = "";
    const onChunk = (chunk: string) => { resultText += chunk; };

    let inputTokens = 0, outputTokens = 0;
    try {
      const result = await streamGeminiResponse(apiKey, messages, onChunk, new AbortController().signal);
      resultText = result.fullText;
      inputTokens = result.usage.inputTokens;
      outputTokens = result.usage.outputTokens;
    } catch {
      try {
        resultText = await streamGroqFallback(messages, onChunk, new AbortController().signal);
      } catch {
        toast({ title: "AI gagal menjelaskan kode", variant: "destructive" });
        setCells(prev => prev.map(c => c.id === cellId ? { ...c, isAiLoading: false } : c));
        return;
      }
    }

    setCells(prev => prev.map(c => c.id === cellId ? { ...c, isAiLoading: false } : c));

    // Tampilkan prompt asli sebagai context + jawaban AI langsung di chat
    const chatMessage = `📖 **Penjelasan Kode** *(dari cell anda)*\n\n${resultText}`;
    onSendAIResult(chatMessage, inputTokens > 0 ? { inputTokens, outputTokens } : undefined);
    showTokenToast(inputTokens, outputTokens, "Explain");
  };

  // ── Debug → langsung call Gemini, hasil tampil di AI Chat sebagai pesan AI ──
  const handleDebug = async (cellId: string) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell || !onSendAIResult) return;

    const apiKey = await getAiKey();
    if (!apiKey) return;

    setCells(prev => prev.map(c => c.id === cellId ? { ...c, isAiLoading: true } : c));
    toast({ title: "🐛 Menganalisis bug...", description: "AI sedang memeriksa kodemu.", duration: 2000 });

    const errorOutput = cell.outputs.filter(o => o.type === "stderr").map(o => o.text).join("\n");
    const prompt = errorOutput
      ? `🐛 **Tolong debug kode Python berikut** dan berikan solusi perbaikannya:\n\n**Kode:**\n\`\`\`python\n${cell.code}\n\`\`\`\n\n**Error:**\n\`\`\`\n${errorOutput}\n\`\`\``
      : `🐛 **Tolong periksa kode Python berikut** — ada kemungkinan bug atau masalah logika:\n\n\`\`\`python\n${cell.code}\n\`\`\``;
    const messages = [{ role: "user" as const, content: prompt }];
    let resultText = "";
    const onChunk = (chunk: string) => { resultText += chunk; };

    let inputTokens = 0, outputTokens = 0;
    try {
      const result = await streamGeminiResponse(apiKey, messages, onChunk, new AbortController().signal);
      resultText = result.fullText;
      inputTokens = result.usage.inputTokens;
      outputTokens = result.usage.outputTokens;
    } catch {
      try {
        resultText = await streamGroqFallback(messages, onChunk, new AbortController().signal);
      } catch {
        toast({ title: "AI gagal debug kode", variant: "destructive" });
        setCells(prev => prev.map(c => c.id === cellId ? { ...c, isAiLoading: false } : c));
        return;
      }
    }

    setCells(prev => prev.map(c => c.id === cellId ? { ...c, isAiLoading: false } : c));

    const chatMessage = `🐛 **Analisis Debug Kode** *(dari cell anda)*\n\n${resultText}`;
    onSendAIResult(chatMessage, inputTokens > 0 ? { inputTokens, outputTokens } : undefined);
    showTokenToast(inputTokens, outputTokens, "Debug");
  };

  // ── ✅ Check Answer → AI Challenge Validation ─────────────────────────────
  const handleCheckChallenge = async (cellId: string) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell || !cell.code.includes("🎯 TANTANGAN")) return;

    const apiKey = await getAiKey();
    if (!apiKey) return;

    // Must run code first to have output
    if (cell.outputs.length === 0) {
      toast({ title: "Belum dijalankan", description: "Jalankan kodenya dulu (▶) baru cek jawaban.", variant: "destructive" });
      return;
    }

    setCells(prev => prev.map(c => c.id === cellId ? { ...c, isVerifying: true } : c));
    toast({ title: "🔍 Sedang memeriksa...", description: "AI sedang mengevaluasi kodemu.", duration: 2000 });

    const outputsText = cell.outputs.map(o => o.text).join("");

    // Extract challenge description from code comments
    const challengeLines = cell.code.split("\n").filter(l => l.trim().startsWith("#")).join("\n");

    const verifyPrompt = `Kamu adalah evaluator kode Python yang memberi feedback kepada mahasiswa.

**Soal Tantangan:**
\`\`\`
${challengeLines}
\`\`\`

**Kode yang Ditulis Mahasiswa:**
\`\`\`python
${cell.code}
\`\`\`

**Output Eksekusi:**
\`\`\`
${outputsText}
\`\`\`

Evaluasi apakah kode tersebut sudah menyelesaikan instruksi soal dengan baik. Berikan balasan yang ramah dan mendidik:
- Jika **BENAR/LULUS**: Mulai dengan "✅ LULUS:" lalu berikan apresiasi dan penjelasan mengapa jawabannya bagus.
- Jika **SALAH/BELUM**: Mulai dengan "❌ BELUM:" lalu berikan hint/petunjuk perbaikan yang mengarahkan (JANGAN berikan jawaban lengkap).`;

    const messages = [{ role: "user" as const, content: verifyPrompt }];
    let resultText = "";

    let inputTokens = 0, outputTokens = 0;
    try {
      const result = await streamGeminiResponse(apiKey, messages, (chunk) => { resultText += chunk; }, new AbortController().signal);
      resultText = result.fullText;
      inputTokens = result.usage.inputTokens;
      outputTokens = result.usage.outputTokens;
    } catch {
      try {
        resultText = await streamGroqFallback(messages, (chunk) => { resultText += chunk; }, new AbortController().signal);
      } catch {
        toast({ title: "Gagal verifikasi", variant: "destructive" });
        setCells(prev => prev.map(c => c.id === cellId ? { ...c, isVerifying: false } : c));
        return;
      }
    }

    setCells(prev => prev.map(c => c.id === cellId ? { ...c, isVerifying: false } : c));
    showTokenToast(inputTokens, outputTokens, "Cek Jawaban");

    const isPass = resultText.toUpperCase().includes("✅ LULUS:") || resultText.toUpperCase().includes("LULUS:");

    if (isPass) {
      // 1. Hapus tag tantangan → isChallengeActive jadi false → lock screen hilang
      // Regex: [^\r\n]* agar match Windows (\r\n) dan Unix (\n) line endings
      const cleanCode = cell.code.replace(/# 🎯 TANTANGAN:[^\r\n]*/g, "# ✅ TANTANGAN SELESAI");
      syncSetCells(prev => prev.map(c => c.id === cellId ? { ...c, code: cleanCode } : c));

      // 2. Kirim hasil evaluasi langsung ke AI Chat sebagai pesan asisten
      if (onSendAIResult) {
        const chatMessage = `🎯 **Hasil Cek Jawaban Tantangan**\n\n${resultText}\n\n---\n*AI Chat sudah terbuka kembali. Lanjutkan belajar atau tanyakan hal lain!* 🚀`;
        onSendAIResult(chatMessage, inputTokens > 0 ? { inputTokens, outputTokens } : undefined, true); // isPass=true
      }

      toast({
        title: "🎉 Selamat! Kamu Lulus!",
        description: "Lihat feedback lengkap di panel AI Chat →",
        className: "bg-emerald-500 text-white border-none",
        duration: 4000,
      });
    } else {
      // Kirim hint langsung ke AI Chat sebagai pesan asisten
      if (onSendAIResult) {
        const chatMessage = `🎯 **Hasil Cek Jawaban Tantangan**\n\n${resultText}\n\n---\n*Perbaiki kodemu dan coba lagi! Semangat! 💪*`;
        onSendAIResult(chatMessage, inputTokens > 0 ? { inputTokens, outputTokens } : undefined, false); // isPass=false — lock screen tetap
      }

      toast({
        title: "❌ Belum Tepat",
        description: "Lihat hint dari AI di panel AI Chat →",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  // ── File import/export ─────────────────────────────────────────────────────
  const handleSavePy = () => {
    const allCode = cells.map((c, i) => `# === Cell ${i + 1} ===\n${c.code}`).join("\n\n");
    const blob = new Blob([allCode], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "notebook.py"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveIpynb = () => {
    const ipynb = {
      cells: cells.map((c) => ({
        cell_type: "code",
        execution_count: c.executionCount,
        metadata: {},
        outputs: [],
        source: c.code.split("\n").map((line, i, arr) => (i === arr.length - 1 ? line : line + "\n")),
      })),
      metadata: {
        kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
        language_info: { name: "python" },
      },
      nbformat: 4,
      nbformat_minor: 4,
    };
    const blob = new Blob([JSON.stringify(ipynb, null, 2)], { type: "application/x-ipynb+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "notebook.ipynb"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "🚀 File .ipynb siap!", description: "Bisa langsung dibuka di Google Colab." });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      let newCells: Cell[] = [];

      try {
        // Try parsing as IPYNB (JSON)
        if (file.name.endsWith(".ipynb")) {
          const ipynb = JSON.parse(content);
          if (ipynb.cells && Array.isArray(ipynb.cells)) {
            newCells = ipynb.cells
              .filter((c: any) => c.cell_type === "code")
              .map((c: any) => {
                const source = Array.isArray(c.source) ? c.source.join("") : (c.source || "");
                return makeCell(source);
              });
          }
        } else {
          // Assume .py or raw text
          const parts = content.split(/^# === Cell \d+ ===/m).map(s => s.trim()).filter(Boolean);
          newCells = parts.length > 0 ? parts.map(cCode => makeCell(cCode)) : [makeCell(content)];
        }
      } catch (err) {
        console.error("Import error:", err);
        toast({ title: "Gagal import file", description: "Format file tidak dikenali atau rusak.", variant: "destructive" });
        return;
      }

      if (newCells.length > 0) {
        syncSetCells(() => newCells);
        setActiveCell(newCells[0].id);
        toast({ title: "📂 File diimport!", description: `${file.name} → ${newCells.length} cell(s).`, duration: 2500 });
      }
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
          <input type="file" accept=".py,.ipynb" ref={fileInputRef} onChange={handleImport} className="hidden" />
          <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1">
            <Upload className="w-3.5 h-3.5" /><span className="hidden sm:inline">Import</span>
          </Button>

          <div className="flex bg-secondary/50 rounded-lg p-0.5 border border-border/50">
            <Button size="sm" variant="ghost" onClick={handleSavePy}
              className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1 hover:bg-background">
              <Download className="w-3 h-3" />.py
            </Button>
            <Button size="sm" variant="ghost" onClick={handleSaveIpynb}
              className="h-6 px-1.5 text-[10px] text-amber-500 hover:text-amber-400 gap-1 hover:bg-background">
              <Download className="w-3 h-3" />.ipynb
            </Button>
          </div>

          <div className="w-px h-4 bg-border mx-1" />

          {/* ── Save to DB button ── */}
          {onSaveCode && (
            <div className="flex bg-secondary/30 rounded-lg p-0.5 border border-border/40">
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
                className={`h-7 px-2.5 rounded-l-md text-[11px] font-medium flex items-center gap-1.5 transition-all duration-200 border-r border-border/40 ${
                  saveStatus === "unsaved"
                    ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 cursor-pointer animate-pulse"
                    : saveStatus === "saving"
                    ? "bg-blue-500/10 text-blue-400 cursor-not-allowed"
                    : saveStatus === "saved"
                    ? "bg-emerald-500/10 text-emerald-400 cursor-default"
                    : saveStatus === "error"
                    ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer animate-pulse"
                    : "text-muted-foreground/50 cursor-default"
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
              <button
                onClick={handleShare}
                disabled={saveStatus === "saving"}
                title="Share link kode ini (Public)"
                className="h-7 px-2.5 rounded-r-md text-[11px] font-medium flex items-center gap-1.5 transition-all duration-200 hover:bg-emerald-500/10 hover:text-emerald-400 text-muted-foreground"
              >
                <Share className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Share</span>
              </button>
            </div>
          )}

          <div className="w-px h-4 bg-border mx-1" />
          {!disableAI && (
            <Button size="sm" onClick={() => setShowChallengeDialog(true)} disabled={isGeneratingChallenge}
              className="h-7 px-2.5 text-[11px] gap-1 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20">
              {isGeneratingChallenge ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Latihan Cepat</span>
            </Button>
          )}
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
            hasChatHandler={!!onSendToChat && !disableAI}
            disableAI={disableAI}
            onActivate={() => setActiveCell(cell.id)}
            onCodeChange={(v) => handleCellCodeChange(cell.id, v)}
            onRun={() => runCell(cell.id)}
            onStop={() => stopCell(cell.id)}
            onDelete={() => deleteCell(cell.id)}
            onMoveUp={() => moveCell(cell.id, "up")}
            onMoveDown={() => moveCell(cell.id, "down")}
            onAddBelow={() => addCellAfter(cell.id)}
            onClearOutput={() => clearCellOutput(cell.id)}
            onExplain={() => handleExplain(cell.id)}
            onDebug={() => handleDebug(cell.id)}
            onCheckChallenge={() => handleCheckChallenge(cell.id)}
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

      {/* ── Challenge Customization Dialog ── */}
      <Dialog open={showChallengeDialog} onOpenChange={setShowChallengeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Custom Latihan Cepat
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Topik atau Keinginan Soal</Label>
              <Input
                id="topic"
                placeholder="Contoh: Soal if else sederhana, Manipulasi List, dll."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerateChallenge()}
              />
              <p className="text-[11px] text-muted-foreground">
                Kosongkan untuk mendapatkan topik acak.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowChallengeDialog(false)}>Batal</Button>
            <Button onClick={handleGenerateChallenge} className="bg-blue-600 hover:bg-blue-500 text-white">
              Buat Tantangan ✨
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  disableAI?: boolean;
  onActivate: () => void;
  onCodeChange: (v: string) => void;
  onRun: () => void;
  onStop: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddBelow: () => void;
  onClearOutput: () => void;
  onExplain: () => void;
  onDebug: () => void;
  onCheckChallenge: () => void;
  onAiGenerate: (prompt: string) => void;
  onEditorWillMount: (monaco: any) => void;
  onProvideInput: (val: string) => void;
}

function CellCard({
  cell, index, totalCells, isActive, monacoTheme, isMobile, isDark, isRuntimeReady,
  hasChatHandler, disableAI, onActivate, onCodeChange, onRun, onStop, onDelete, onMoveUp, onMoveDown,
  onAddBelow, onClearOutput, onExplain, onDebug, onCheckChallenge, onAiGenerate, onEditorWillMount, onProvideInput
}: CellCardProps) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [isFolded, setIsFolded] = useState(false);

  const hasError = cell.outputs.some(o => o.type === "stderr");
  const hasOutput = cell.outputs.length > 0;
  const showOutputBox = hasOutput || !!cell.activeInput;

  const lineCount = Math.min(30, Math.max(3, cell.code.split("\n").length));
  const editorHeight = lineCount * (isMobile ? 20 : 22) + 32;

  // ── Aturan Tantangan: Jika cell ini berisi soal tantangan, matikan bantuan AI ──
  const isChallenge = cell.code.includes("🎯 TANTANGAN");

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

        {/* Run/Stop button */}
        <button
          onClick={(e) => { 
            e.stopPropagation(); 
            if (cell.isRunning) onStop();
            else onRun(); 
          }}
          disabled={!isRuntimeReady && !cell.isRunning}
          title={cell.isRunning ? "Stop cell" : "Run cell (Ctrl+Enter)"}
          className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-150 ${
            cell.isRunning
              ? "border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:border-red-500/70 cursor-pointer shadow-[0_0_8px_rgba(239,68,68,0.4)]"
              : isRuntimeReady
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/70 hover:shadow-[0_0_8px_rgba(52,211,153,0.3)]"
              : "border-border/30 text-muted-foreground cursor-not-allowed"
          }`}
        >
          {cell.isRunning
            ? <Square className="w-3.5 h-3.5" fill="currentColor" />
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
          {!disableAI && (
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                if (!isChallenge) setShowAiPrompt(v => !v); 
                else onCheckChallenge();
              }}
              title={isChallenge ? "Validasi jawabanmu dengan AI ✨" : "AI: Buat kode dari deskripsi"}
              disabled={cell.isVerifying}
              className={`h-6 px-1.5 rounded text-[10px] font-medium flex items-center gap-1 transition-all ${
                isChallenge 
                  ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]" 
                  : showAiPrompt
                  ? "bg-violet-500/15 text-violet-400"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {cell.isVerifying ? <Loader2 className="w-3 h-3 animate-spin" /> : (isChallenge ? <CheckCircle2 className="w-3 h-3" /> : <SparklesIcon className="w-3 h-3" />)}
              <span className="hidden sm:inline">{isChallenge ? (cell.isVerifying ? "Memeriksa..." : "Cek Jawaban ✨") : "AI Generate"}</span>
            </button>
          )}

          {/* 📖 Explain → AI Chat */}
          {hasChatHandler && (
            <button
              onClick={(e) => { e.stopPropagation(); if (!isChallenge) onExplain(); }}
              disabled={isChallenge}
              title={isChallenge ? "Fitur dimatikan: Coba artikan kodenya secara mandiri!" : "Jelaskan kode ini di AI Chat"}
              className={`h-6 px-1.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
                isChallenge ? "opacity-30 cursor-not-allowed text-muted-foreground" :
                "text-muted-foreground hover:bg-blue-500/10 hover:text-blue-400"
              }`}
            >
              <BookOpen className="w-3 h-3" />
              <span className="hidden sm:inline">Explain</span>
            </button>
          )}

          {/* 🐛 Debug → AI Chat */}
          {hasChatHandler && (
            <button
              onClick={(e) => { e.stopPropagation(); if (!isChallenge) onDebug(); }}
              disabled={isChallenge}
              title={isChallenge ? "Fitur dimatikan: Cari dan perbaiki bug sendiri!" : "Debug kode ini di AI Chat"}
              className={`h-6 px-1.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
                isChallenge ? "opacity-30 cursor-not-allowed text-muted-foreground" :
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
