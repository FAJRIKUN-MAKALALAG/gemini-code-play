import { Loader2, CheckCircle2, BrainCircuit, ShieldCheck } from "lucide-react";

interface AIStatusIndicatorProps {
  stage: 'idle' | 'thinking' | 'verifying' | 'done';
  modelMode?: 'fast' | 'reasoning';
}

export const AIStatusIndicator = ({ stage, modelMode = 'fast' }: AIStatusIndicatorProps) => {
  if (stage === 'idle') return null;

  return (
    <div className="flex items-center gap-3 p-4 text-sm text-gray-500 animate-in fade-in zoom-in duration-300">
      
      {/* TAHAP 1: BERPIKIR */}
      {stage === 'thinking' && (
        <>
          <BrainCircuit className={`w-5 h-5 animate-pulse ${modelMode === 'reasoning' ? 'text-purple-500' : 'text-blue-500'}`} />
          <span className="animate-pulse">
            {modelMode === 'reasoning' ? "AI is deep-thinking..." : "AI sedang berpikir..."}
          </span>
        </>
      )}

      {/* TAHAP 2: MEMASTIKAN (VERIFYING) */}
      {stage === 'verifying' && (
        <>
          <ShieldCheck className="w-5 h-5 animate-bounce text-orange-500" />
          <span>Memastikan respon...</span>
        </>
      )}

      {/* TAHAP 3: SELESAI (CENTANG) */}
      {stage === 'done' && (
        <>
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <span className="text-green-600 font-medium">Selesai! Menampilkan jawaban.</span>
        </>
      )}
    </div>
  );
};
