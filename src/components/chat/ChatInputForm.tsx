import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";

interface ChatInputFormProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  noApiKey: boolean;
}

export function ChatInputForm({ onSend, isLoading, noApiKey }: ChatInputFormProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const h = Math.max(44, Math.min(textareaRef.current.scrollHeight, 200));
      textareaRef.current.style.height = h + 'px';
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-2 sm:p-4 shrink-0">
      <div className="relative max-w-3xl mx-auto">
        <div className="bg-secondary/60 backdrop-blur-md rounded-2xl border border-border/50 shadow-md p-2 flex items-end gap-2 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-200">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={noApiKey ? "Add an API key to start chatting..." : "Ask UNKLAB AI..."}
            className="flex-1 min-h-[36px] sm:min-h-[44px] max-h-[200px] border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-1.5 sm:py-2.5 resize-none text-base sm:text-sm placeholder:text-muted-foreground/60 leading-relaxed"
            disabled={isLoading || noApiKey}
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || noApiKey}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl p-0 flex items-center justify-center transition-all duration-200 shrink-0 ${input.trim() && !noApiKey ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground'}`}
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-center text-muted-foreground/40 mt-1.5 px-2 italic">
          AI can make mistakes. Always verify important information.
        </p>
      </div>
    </div>
  );
}
