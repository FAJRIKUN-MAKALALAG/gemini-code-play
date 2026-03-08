import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "@/services/authService";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { ErrorAlert } from "@/components/ErrorAlert";

// ─── Specific auth error message mapping ──────────────────────────────────────
function mapAuthError(rawMessage: string, mode: "signin" | "signup"): { title: string; message: string } {
  const msg = rawMessage.toLowerCase();

  // Signup: email already exists
  if (mode === "signup" && (msg.includes("already") || msg.includes("registered") || msg.includes("exists") || msg.includes("duplicate") || msg.includes("unique"))) {
    return { title: "Email Sudah Digunakan", message: "Email sudah terdaftar. Silakan gunakan email lain atau login." };
  }

  // Login: user not found
  if (mode === "signin" && (msg.includes("not found") || msg.includes("no user") || msg.includes("invalid login") || msg.includes("user does not exist"))) {
    return { title: "Akun Tidak Ditemukan", message: "Akun tidak ditemukan. Silakan Signup terlebih dahulu." };
  }

  // Wrong password
  if (msg.includes("password") || msg.includes("credentials") || msg.includes("invalid") || msg.includes("incorrect")) {
    return { title: "Password Salah", message: "Password salah. Silakan coba lagi." };
  }

  // Server error
  if (msg.includes("500") || msg.includes("503") || msg.includes("server") || msg.includes("unavailable")) {
    return { title: "Server Bermasalah", message: "Server sedang bermasalah, silakan coba beberapa saat lagi." };
  }

  // Fallback
  return {
    title: mode === "signin" ? "Sign In Gagal" : "Sign Up Gagal",
    message: rawMessage || "Terjadi kesalahan. Silakan coba lagi.",
  };
}

interface AuthScreenProps {
  onAuthenticated?: () => void;
}

export const AuthScreen = ({ onAuthenticated }: AuthScreenProps) => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Global error state for inline alert box
  const [errorTitle, setErrorTitle] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showError = (title: string, message: string, status?: number, rawMsg?: string) => {
    setErrorTitle(title);
    setErrorMessage(message);
    console.error(`[ERROR_LOG] Status: ${status ?? "unknown"} | Message: ${rawMsg ?? message}`);
  };

  const clearError = () => { setErrorTitle(null); setErrorMessage(null); };

  useEffect(() => { setVisible(true); }, []);

  // Clear error when switching mode
  useEffect(() => { clearError(); }, [mode]);

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError("Format Email Salah", "Masukkan alamat email yang valid.", 0);
      return false;
    }
    if (password.length < 6) {
      showError("Password Terlalu Pendek", "Password harus minimal 6 karakter.", 0);
      return false;
    }
    if (mode === "signup" && !username.trim()) {
      showError("Username Wajib", "Masukkan username untuk akunmu.", 0);
      return false;
    }
    return true;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validateForm()) return;

    setLoading(true);

    try {
      const { error } =
        mode === "signin"
          ? await authService.login(email, password)
          : await authService.signup(email, password, username);

      if (error) {
        setLoading(false);
        const raw = error.message || "";
        const mapped = mapAuthError(raw, mode);
        showError(mapped.title, mapped.message, undefined, raw);
        return;
      }

      // Success
      setLoading(false);
      setIsExiting(true);
      setTimeout(() => {
        onAuthenticated?.();
        window.location.reload();
      }, 800);

    } catch (err: any) {
      setLoading(false);
      const raw = err?.message || String(err);
      const mapped = mapAuthError(raw, mode);
      showError(mapped.title, mapped.message, err?.status, raw);
    }
  };

  const toggleMode = () => {
    if (loading) return;
    setMode(mode === "signin" ? "signup" : "signin");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/80 backdrop-blur-sm">
      {/* Background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] animate-pulse-slow pointer-events-none" />

      {/* ── Global Error Alert — top center ── */}
      <ErrorAlert message={errorMessage} title={errorTitle ?? undefined} onClose={clearError} />

      <div
        className={`relative w-full max-w-md mx-4 transition-all duration-500 ease-out transform ${visible && !isExiting ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
          }`}
      >
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="p-8 text-center bg-gradient-to-b from-primary/5 to-transparent">
            <div className="w-20 h-20 bg-background rounded-2xl shadow-lg mx-auto mb-6 flex items-center justify-center transform transition-transform hover:rotate-12 duration-500">
              <img src="/AicodeLogo.png" alt="AIcode Logo" className="w-16 h-16 dark-invert" draggable={false} />
            </div>
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 mb-2">
              {mode === "signin" ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {mode === "signin"
                ? "Enter your credentials to access your workspace"
                : "Join us and start your AI coding journey"}
            </p>
          </div>

          {/* Form */}
          <div className="p-8 pt-0">
            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-4">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email" type="email" placeholder="name@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all"
                    required disabled={loading}
                  />
                </div>

                {/* Username (signup only) */}
                {mode === "signup" && (
                  <div className="space-y-2 animate-in slide-in-from-left-4 fade-in duration-500">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username" type="text" placeholder="Display Name"
                      value={username} onChange={(e) => setUsername(e.target.value)}
                      className="bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all"
                      required disabled={loading}
                    />
                  </div>
                )}

                {/* Password */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <Link
                        to="/forgot-password"
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                        tabIndex={loading ? -1 : undefined}
                      >
                        Lupa Password?
                      </Link>
                    )}
                  </div>
                  <Input
                    id="password" type="password" placeholder="••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all"
                    required disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit" disabled={loading}
                className="w-full h-11 text-lg font-medium shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  mode === "signin" ? "Sign In" : "Create Account"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-sm text-muted-foreground">
                {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              </span>
              <button
                type="button" onClick={toggleMode} disabled={loading}
                className="text-sm font-semibold text-primary hover:underline focus:outline-none transition-colors disabled:opacity-50"
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
