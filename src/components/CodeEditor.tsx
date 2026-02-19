import { Editor } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Play, Trash2, SquareTerminal, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { DebugButton } from "./DebugButton";

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
}: CodeEditorProps) => {
  const { resolvedTheme } = useTheme();

  const handleEditorWillMount = (monaco: any) => {
    monaco.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: { 'editor.background': '#000000' }
    });
  };

  return (
    <div className="flex flex-col h-full bg-editor-bg rounded-lg overflow-hidden border border-border shadow-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-secondary border-b border-border shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Python Editor</h2>
        <div className="flex gap-1.5 sm:gap-2 items-center">
          {onToggleTerminal && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleTerminal}
              className={`h-8 px-2 sm:px-3 text-xs gap-1.5 ${showTerminal ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title={showTerminal ? "Hide Terminal" : "Show Terminal"}
            >
              <SquareTerminal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">Terminal</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onClear}
            className="h-8 px-2 sm:px-3 text-xs gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
          <Button
            size="sm"
            onClick={onRun}
            disabled={!isRuntimeReady}
            title={!isRuntimeReady ? "Loading Python runtime..." : "Run code (Ctrl+Enter)"}
            className="h-8 px-2.5 sm:px-3 text-xs gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 hover:shadow-glow-accent transition-all disabled:opacity-60"
          >
            {!isRuntimeReady ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden xs:inline sm:inline">{isRuntimeReady ? "Run" : "Loading..."}</span>
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
          theme={resolvedTheme === 'dark' ? 'custom-dark' : 'light'}
          beforeMount={handleEditorWillMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "JetBrains Mono, Fira Code, monospace",
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
