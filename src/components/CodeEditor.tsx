import { useRef, useState, useEffect } from "react";
import { Editor } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Play, Trash2, SquareTerminal, Loader2, Download, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { DebugButton } from "./DebugButton";
import { useToast } from "@/hooks/use-toast";

interface CodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onClear: () => void;
  showTerminal?: boolean;
  onToggleTerminal?: () => void;
  lastError?: string | null;
  onDebug?: (message: string) => void;
  isRuntimeReady?: boolean;
  isRunning?: boolean;
}

export const CodeEditor = ({
  code,
  onChange,
  onRun,
  onClear,
  showTerminal = true,
  onToggleTerminal,
  lastError,
  onDebug,
  isRuntimeReady = true,
  isRunning = false,
}: CodeEditorProps) => {
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleEditorWillMount = (monaco: any) => {
    // ── Custom Dark Theme (VS Code inspired, synced ke app bg) ─────────────────
    monaco.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        // Keywords: def, class, return, if, for, while, import, from, as, with, ...
        { token: 'keyword', foreground: 'c792ea' },  // 🟣 ungu
        { token: 'keyword.control', foreground: 'f97583' },  // 🔴 merah muda
        // Built-in functions: print, len, range, type, input, ...
        { token: 'support.function', foreground: 'ffcb6b' },  // 🟡 kuning emas
        // String literals
        { token: 'string', foreground: 'c3e88d' },  // 🟢 hijau muda
        { token: 'string.escape', foreground: 'f78c6c' },  // 🟠 oranye (escape char)
        // Comments
        { token: 'comment', foreground: '546e7a', fontStyle: 'italic' },
        // Numbers
        { token: 'number', foreground: 'f78c6c' },  // 🟠 oranye
        { token: 'number.float', foreground: 'f78c6c' },
        // Function & class names
        { token: 'entity.name.function', foreground: '82aaff' },  // 🔵 biru
        { token: 'entity.name.class', foreground: 'ffcb6b' },  // 🟡 kuning
        // Self, True, False, None
        { token: 'variable.language', foreground: 'f07178' },  // 🔴 merah muda
        { token: 'constant.language', foreground: 'ff5370' },  // 🔴 merah
        // Operators: =, +, -, *, /, ==, !=, ...
        { token: 'operator', foreground: '89ddff' },  // 🩵 biru muda
        // Decorator: @staticmethod, @property, ...
        { token: 'meta.decorator', foreground: 'c792ea' },
        // Type hints
        { token: 'entity.name.type', foreground: 'ffcb6b' },
      ],
      colors: {
        'editor.background': '#09090b', // zinc-950 — cocok dgn app bg
        'editor.foreground': '#cdd3de',
        'editor.lineHighlightBackground': '#ffffff08',
        'editor.selectionBackground': '#4a4a7a66',
        'editorCursor.foreground': '#c792ea',
        'editorLineNumber.foreground': '#37474f',
        'editorLineNumber.activeForeground': '#78909c',
        'editorIndentGuide.background': '#ffffff10',
        'editorGutter.background': '#09090b',
      }
    });

    // ── Custom Light Theme (high contrast, tetap nyaman dibaca) ────────────────
    monaco.editor.defineTheme('custom-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '7c3aed' },  // 🟣 ungu gelap
        { token: 'keyword.control', foreground: 'd63031' },  // 🔴 merah
        { token: 'support.function', foreground: 'b45309' },  // 🟡 coklat-kuning
        { token: 'string', foreground: '16803a' },  // 🟢 hijau gelap
        { token: 'string.escape', foreground: 'd97706' },  // 🟠 oranye
        { token: 'comment', foreground: '94a3b8', fontStyle: 'italic' },
        { token: 'number', foreground: 'c2410c' },  // 🟠 oranye tua
        { token: 'number.float', foreground: 'c2410c' },
        { token: 'entity.name.function', foreground: '1d4ed8' },  // 🔵 biru gelap
        { token: 'entity.name.class', foreground: 'b45309' },
        { token: 'variable.language', foreground: 'be185d' },  // 🩷 pink gelap
        { token: 'constant.language', foreground: 'be185d' },
        { token: 'operator', foreground: '0369a1' },  // 🔵 biru muda gelap
        { token: 'entity.name.type', foreground: 'b45309' },
      ],
      colors: {
        'editor.background': '#fafafa',
        'editor.foreground': '#1e293b',
        'editor.lineHighlightBackground': '#00000008',
        'editor.selectionBackground': '#7c3aed22',
        'editorCursor.foreground': '#7c3aed',
        'editorLineNumber.foreground': '#94a3b8',
        'editorLineNumber.activeForeground': '#475569',
        'editorIndentGuide.background': '#00000015',
      }
    });
  };

  // ── Save as .py ────────────────────────────────────────────────────────────
  const handleSavePy = () => {
    try {
      const blob = new Blob([code], { type: 'text/x-python' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'code.py';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Gagal Menyimpan', description: 'Tidak bisa menyimpan file. Coba lagi.', variant: 'destructive' });
    }
  };

  // ── Import .py ─────────────────────────────────────────────────────────────
  const handleImportPy = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.py')) {
      toast({ title: 'Format Tidak Didukung', description: 'Hanya file .py yang dapat diimport.', variant: 'destructive' });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      onChange(content);
      toast({ title: 'File Diimport', description: `${file.name} berhasil dimuat.`, duration: 2000 });
    };
    reader.onerror = () => {
      toast({ title: 'Gagal Membaca File', description: 'File tidak bisa dibaca. Coba lagi.', variant: 'destructive' });
    };
    reader.readAsText(file);
    e.target.value = ''; // reset so same file can be re-imported
  };

  return (
    <div className="flex flex-col h-full bg-editor-bg rounded-lg overflow-hidden border border-border shadow-card">
      {/* ── Toolbar ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1.5 sm:px-4 py-1.5 sm:py-3 bg-secondary border-b border-border shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex gap-1 sm:gap-1.5 items-center mr-1 sm:mr-3">
            <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-red-400/80" />
            <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-amber-400/80" />
            <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-green-400/80" />
          </div>
          <span className="text-[10px] sm:text-sm font-semibold text-foreground/80 font-mono tracking-tight flex items-center gap-1 sm:gap-2">
            main.py
            <span className="hidden xs:inline text-[9px] sm:text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-md bg-secondary border border-border">Python 3.10</span>
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Action buttons (icon only on mobile) */}
          {onToggleTerminal && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleTerminal}
              className={`h-8 w-8 sm:w-auto px-0 sm:px-2.5 gap-1.5 ${showTerminal ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title={showTerminal ? "Hide Terminal" : "Show Terminal"}
            >
              <SquareTerminal className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline text-xs">Terminal</span>
            </Button>
          )}

          <input
            type="file"
            accept=".py"
            ref={fileInputRef}
            onChange={handleImportPy}
            className="hidden"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            title="Import .py (Ctrl+O)"
            className="h-8 w-8 sm:w-auto px-0 sm:px-2.5 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Upload className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline text-xs">Import</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleSavePy}
            disabled={!code.trim()}
            title="Save .py (Ctrl+S)"
            className="h-8 w-8 sm:w-auto px-0 sm:px-2.5 gap-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline text-xs">Save</span>
          </Button>

          <div className="w-px h-4 bg-border mx-0 sm:mx-1 hidden xs:block" />

          {onClear && (
            <Button
              size="sm"
              variant="outline"
              onClick={onClear}
              title="Clear terminal output"
              className="h-8 w-8 sm:w-auto px-0 sm:px-2.5 gap-1.5 ml-0 sm:ml-1"
            >
              <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline text-xs">Clear</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={onRun}
            disabled={!isRuntimeReady || isRunning}
            title={!isRuntimeReady ? "Loading Python runtime..." : isRunning ? "Code is executing..." : "Run code (Ctrl+Enter)"}
            className="h-7 px-2 sm:h-8 sm:px-4 text-[11px] sm:text-xs font-medium gap-1 sm:gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 hover:shadow-glow-accent transition-all disabled:opacity-60"
          >
            {(!isRuntimeReady || isRunning) ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            <span className="hidden xs:inline">{!isRuntimeReady ? "Wait" : isRunning ? "Running" : "Run"}</span>
          </Button>
          {onDebug && (
            <DebugButton
              code={code}
              lastError={lastError ?? null}
              onSendMessage={onDebug}
            />
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="python"
          value={code}
          onChange={(value) => onChange(value || "")}
          theme={resolvedTheme === 'dark' ? 'custom-dark' : 'custom-light'}
          beforeMount={handleEditorWillMount}
          options={{
            minimap: { enabled: false },
            fontSize: isMobile ? 12 : 14,
            fontFamily: "JetBrains Mono, Fira Code, monospace",
            lineHeight: isMobile ? 20 : 24,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            padding: { top: 16, bottom: 16 },
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            wordWrap: "on",
          }}
        />
      </div>
    </div>
  );
};

