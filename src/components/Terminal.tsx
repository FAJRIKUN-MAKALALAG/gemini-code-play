interface TerminalProps {
  output: string[];
}

export const Terminal = ({ output }: TerminalProps) => {
  return (
    <div className="flex flex-col h-full bg-terminal-bg rounded-lg overflow-hidden border border-border shadow-card">
      <div className="flex items-center justify-between px-4 py-3 bg-secondary border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Terminal Output</h2>
      </div>
      <div className="flex-1 overflow-auto p-4 font-mono text-sm">
        {output.length === 0 ? (
          <div className="text-muted-foreground italic">
            Run your Python code to see output here...
          </div>
        ) : (
          output.map((line, index) => (
            <div
              key={index}
              className={`py-0.5 ${
                line.startsWith("Error:") || line.startsWith("Traceback")
                  ? "text-terminal-error"
                  : "text-terminal-text"
              }`}
            >
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
