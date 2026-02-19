/**
 * ErrorAlert.tsx
 * Global dismissible error box — shown at top-center of screen.
 * Usage:
 *   <ErrorAlert message={errorMsg} onClose={() => setErrorMsg(null)} />
 */
import { X, AlertCircle } from "lucide-react";

interface ErrorAlertProps {
  message: string | null;
  onClose: () => void;
  /** Optional title override */
  title?: string;
}

export const ErrorAlert = ({ message, onClose, title = "Terjadi Kesalahan" }: ErrorAlertProps) => {
  if (!message) return null;

  return (
    // Fixed top-center overlay (not full-screen blocking)
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4 animate-in slide-in-from-top-3 fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3 rounded-xl border border-red-500/60 bg-red-50 dark:bg-red-950/60 px-4 py-3.5 shadow-2xl shadow-red-500/10 backdrop-blur-md">
        {/* Icon */}
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-red-700 dark:text-red-300 leading-snug">{title}</p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-0.5 leading-relaxed">{message}</p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
          aria-label="Tutup notifikasi"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
