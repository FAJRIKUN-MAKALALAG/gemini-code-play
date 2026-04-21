import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIStatusIndicatorProps {
  stage: 'idle' | 'thinking' | 'verifying' | 'done';
}

const steps = [
  {
    id: 'thinking',
    label: 'Menganalisis permintaan',
  },
  {
    id: 'verifying',
    label: 'Memproses konteks & data',
  },
  {
    id: 'done',
    label: 'Menyiapkan respons',
  }
];

export const AIStatusIndicator = ({ stage }: AIStatusIndicatorProps) => {
  if (stage === 'idle') return null;

  const stageIndex = stage === 'thinking' ? 0 : stage === 'verifying' ? 1 : stage === 'done' ? 2 : -1;

  return (
    <div className="flex flex-col gap-2.5 py-1 px-2 sm:px-3 mb-2 w-full max-w-[98%]">
      {steps.map((step, idx) => {
        const isCompleted = idx < stageIndex || stage === 'done';
        const isActive = idx === stageIndex && stage !== 'done';
        const isPending = idx > stageIndex && stage !== 'done';

        // Hanya tampilkan tahap yang sudah selesai atau sedang aktif
        // Ini menciptakan efek langkah demi langkah yang organik (tanpa border/kotak)
        if (isPending) return null;

        return (
          <div key={step.id} className={cn(
            "flex items-center gap-3 text-xs sm:text-sm animate-in slide-in-from-top-2 fade-in duration-300",
            isActive ? "text-foreground font-medium" : "text-muted-foreground"
          )}>
            <div className="flex-shrink-0 relative flex items-center justify-center w-5 h-5">
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-in zoom-in duration-300" />
              ) : isActive ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : null}
            </div>
            <span className={cn(
              "tracking-wide",
              isActive && "animate-pulse text-primary/90"
            )}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
