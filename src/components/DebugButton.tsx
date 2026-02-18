import { useState } from "react";
import { Bug, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DebugButtonProps {
  code: string;
  lastError: string | null;
  onSendMessage: (message: string) => void;
}

export const DebugButton = ({ code, lastError, onSendMessage }: DebugButtonProps) => {
  const [isSending, setIsSending] = useState(false);

  const handleDebug = async () => {
    if (!lastError) return;
    setIsSending(true);
    const prompt = `Tolong debug kode Python saya ini:\n\n\`\`\`python\n${code}\n\`\`\`\n\nError:\n${lastError}`;
    onSendMessage(prompt);
    setIsSending(false);
  };

  if (!lastError) return null;

  return (
    <Button
      size="sm"
      onClick={handleDebug}
      disabled={isSending}
      className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white border-0 shadow-lg shadow-red-900/40 animate-pulse-once transition-all"
      title="Kirim error ke AI untuk dianalisis"
    >
      {isSending ? (
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
      ) : (
        <Bug className="w-4 h-4 mr-1.5" />
      )}
      AI Debug
    </Button>
  );
};
