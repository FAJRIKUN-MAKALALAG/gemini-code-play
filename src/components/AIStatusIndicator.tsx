import { Loader2, CheckCircle2, BrainCircuit, ShieldCheck } from "lucide-react";

interface AIStatusIndicatorProps {
  stage: 'idle' | 'thinking' | 'verifying' | 'done';
}

export const AIStatusIndicator = ({ stage }: AIStatusIndicatorProps) => {
  if (stage === 'idle') return null;

  return (
    <div className="flex items-start gap-3 py-2 text-sm text-muted-foreground animate-in fade-in duration-300">
      <div className="mt-0.5">
        {stage === 'thinking' && <BrainCircuit className="w-4 h-4 animate-pulse text-primary" />}
        {stage === 'verifying' && <ShieldCheck className="w-4 h-4 animate-bounce text-orange-400" />}
        {stage === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
      </div>
      <span className={stage === 'done' ? 'text-green-500 font-medium' : 'animate-pulse'}>
        {stage === 'thinking' && "AI sedang berpikir..."}
        {stage === 'verifying' && "Memastikan respon..."}
        {stage === 'done' && "Selesai! Menampilkan jawaban."}
      </span>
    </div>
  );
};
