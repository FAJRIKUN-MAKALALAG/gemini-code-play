import { Editor } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Play, Trash2, ArrowRight } from "lucide-react";

interface CodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onClear: () => void;
  onSendToChat: () => void;
}

export const CodeEditor = ({ code, onChange, onRun, onClear, onSendToChat }: CodeEditorProps) => {
  return (
    <div className="flex flex-col h-full bg-editor-bg rounded-lg overflow-hidden border border-border shadow-card">
      <div className="flex items-center justify-between px-4 py-3 bg-secondary border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Python Editor</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onClear}
            className="h-8 px-3"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Clear
          </Button>
          <Button
            size="sm"
            onClick={onRun}
            className="h-8 px-3 bg-accent text-accent-foreground hover:bg-accent/90 hover:shadow-glow-accent transition-all"
          >
            <Play className="w-4 h-4 mr-1.5" />
            Run
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onSendToChat}
            className="h-8 px-3 border-primary/50 hover:bg-primary/10 hover:border-primary transition-all"
          >
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="python"
          value={code}
          onChange={(value) => onChange(value || "")}
          theme="vs-dark"
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
          }}
        />
      </div>
    </div>
  );
};
