import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X, AlertTriangle } from "lucide-react";

interface ChatInputFormProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isLoading: boolean;
  noApiKey: boolean;
}

export function ChatInputForm({ onSend, onStop, isLoading, noApiKey }: ChatInputFormProps) {
  const [input, setInput] = useState("");
  const [showDisclaimer, setShowDisclaimer] = useState(false);
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
            placeholder={
              isLoading
                ? "AI sedang menjawab..."
                : noApiKey
                ? "Add an API key to start chatting..."
                : "Ask UNKLAB AI..."
            }
            className="flex-1 min-h-[36px] sm:min-h-[44px] max-h-[200px] border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-1.5 sm:py-2.5 resize-none text-base sm:text-sm placeholder:text-muted-foreground/60 leading-relaxed"
            disabled={isLoading || noApiKey}
            rows={1}
          />

          {isLoading ? (
            <Button
              onClick={onStop}
              title="Hentikan respons AI"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl p-0 flex items-center justify-center shrink-0 bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!input.trim() || noApiKey}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl p-0 flex items-center justify-center transition-all duration-200 shrink-0 ${
                input.trim() && !noApiKey
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          )}
        </div>
        {/* Toggleable Disclaimer Section */}
        {!isLoading && (
          <div className="mt-3 flex flex-col items-center">
            {!showDisclaimer ? (
              <button 
                onClick={() => setShowDisclaimer(true)}
                className="text-[10px] text-muted-foreground/40 hover:text-primary transition-colors flex items-center gap-1.5 py-1 px-3 rounded-full hover:bg-secondary/50"
              >
                <AlertTriangle className="w-2.5 h-2.5 uppercase" />
                <span>Disclaimer AI</span>
              </button>
            ) : (
              <div className="w-full mt-2 p-3 sm:p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 flex gap-3 items-start animate-in zoom-in-95 duration-300 relative">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
                <div className="text-[10px] sm:text-[11px] leading-relaxed text-red-900 dark:text-red-300 pr-6">
                  <p className="font-bold text-red-600 dark:text-red-400 mb-1 uppercase tracking-tight">Peringatan Penting & Disclaimer</p>
                  <p className="mb-1.5 italic">
                    AICode didukung oleh model bahasa besar (LLM) yang dapat memberikan informasi atau kode yang 
                    <span className="font-bold underline decoration-red-300 dark:decoration-red-800/80 ml-1">tidak akurat, tidak lengkap, atau tidak aman.</span>
                  </p>
                  <ul className="list-disc pl-4 space-y-1 mb-2 text-red-800/90 dark:text-red-300/80">
                    <li>AI dapat berhalusinasi dan memberikan logika pemrograman yang salah.</li>
                    <li>Kami tidak bertanggung jawab atas kegagalan sistem atau kerugian akibat penggunaan saran AI ini.</li>
                    <li>Selalu lakukan peninjauan kode (*Code Review*) dan pengujian mendalam secara mandiri.</li>
                  </ul>
                  <p className="font-bold text-red-700 dark:text-red-400/90">
                    Anda memegang tanggung jawab penuh atas setiap keputusan dan implementasi kode Anda.
                  </p>
                </div>
                <button 
                  onClick={() => setShowDisclaimer(false)}
                  className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-red-200/50 dark:hover:bg-red-900/30 text-red-400 dark:text-red-500/50 hover:text-red-700 dark:hover:text-red-400 transition-all duration-200"
                  title="Tutup"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-muted-foreground/60 animate-pulse">
            <div className="w-1 h-1 rounded-full bg-primary" />
            AI sedang memproses permintaanmu... Klik ikon silang untuk membatalkan.
          </div>
        )}
      </div>
    </div>
  );
}
