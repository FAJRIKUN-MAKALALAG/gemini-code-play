import * as React from "react";
interface TerminalProps {
  output: string[];
  prompt?: string | null;
  onSubmitInput?: (value: string) => void;
  disabled?: boolean;
}

export const Terminal = ({ output, prompt, onSubmitInput, disabled }: TerminalProps) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!onSubmitInput) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const value = (data.get("terminal-input") as string) || "";
    onSubmitInput(value);
    form.reset();
  };
  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [output, prompt]);

  React.useEffect(() => {
    if (prompt !== null && inputRef.current) {
      inputRef.current.focus();
    }
  }, [prompt]);
  return (
    <div className="flex flex-col h-full bg-terminal-bg rounded-lg overflow-hidden border border-border shadow-card">
      <div className="flex items-center justify-between px-4 py-3 bg-secondary border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Terminal Output</h2>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto p-4 font-mono text-sm">
        {output.length === 0 ? (
          <div className="text-muted-foreground italic">
            Run your Python code to see output here...
          </div>
        ) : (
          output.map((line, index) => (
            <div
              key={index}
              className={`py-0.5 whitespace-pre-wrap ${
                line.startsWith("Error:") || line.startsWith("Traceback")
                  ? "text-terminal-error"
                  : "text-terminal-text"
              }`}
            >
              {line}
            </div>
          ))
        )}
        {onSubmitInput && prompt !== null && (
          <form onSubmit={handleSubmit} className="mt-1">
            <div className="flex items-center gap-2">
              <span className="text-terminal-text">{prompt || "Input"}</span>
              <input
                ref={inputRef}
                name="terminal-input"
                type="text"
                className="flex-1 bg-transparent text-foreground text-sm px-0 py-0 outline-none border-0"
                disabled={disabled}
                autoComplete="off"
              />
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
