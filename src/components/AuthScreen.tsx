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
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const handleGoogleLogin = async () => {
    clearError();
    setGoogleLoading(true);
    const { error } = await authService.loginWithGoogle();
    if (error) {
      setGoogleLoading(false);
      showError("Google Sign In Gagal", error.message || "Tidak bisa menghubungkan ke Google. Coba lagi.");
    }
    // If no error, browser redirects to Google — no need to reset loading
  };

  const toggleMode = () => {
    if (loading) return;
    setMode(mode === "signin" ? "signup" : "signin");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-background/80 backdrop-blur-sm">
      <div className="min-h-full w-full flex flex-col items-center justify-center py-6 sm:py-12 relative">
        {/* Background blobs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse-slow" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] animate-pulse-slow" />
        </div>

        {/* ── Global Error Alert — top center ── */}
        <ErrorAlert message={errorMessage} title={errorTitle ?? undefined} onClose={clearError} />

        <div
          className={`relative z-10 w-full max-w-md mx-4 transition-all duration-500 ease-out transform ${visible && !isExiting ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
            }`}
        >
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="p-6 sm:p-8 text-center bg-gradient-to-b from-primary/5 to-transparent">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-background rounded-2xl shadow-lg mx-auto mb-4 sm:mb-6 flex items-center justify-center transform transition-transform hover:rotate-12 duration-500">
              <img src="/AicodeLogo.png" alt="AIcode Logo" className="w-12 h-12 sm:w-16 sm:h-16 dark-invert" draggable={false} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 mb-1 sm:mb-2 text-balance leading-tight">
              {mode === "signin" ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="text-muted-foreground text-[13px] sm:text-sm px-2">
              {mode === "signin"
                ? "Enter your credentials to access your workspace"
                : "Join us and start your AI coding journey"}
            </p>
          </div>

          {/* Form */}
          <div className="p-6 sm:p-8 pt-0">
            <form onSubmit={handleAuth} className="space-y-4 sm:space-y-5">
              <div className="space-y-4">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email" type="email" placeholder="name@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all text-base sm:text-sm"
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
                      className="bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all text-base sm:text-sm"
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
                    className="bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all text-base sm:text-sm"
                    required disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit" disabled={loading}
                className="w-full h-10 sm:h-11 text-base sm:text-lg font-medium shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  mode === "signin" ? "Sign In" : "Create Account"
                )}
              </Button>

              {/* Toggle Mode */}
              <div className="text-center text-sm text-muted-foreground mt-4">
                {mode === "signin" ? (
                  <>
                    Belum punya akun?{' '}
                    <button
                      type="button"
                      onClick={toggleMode}
                      className="text-primary hover:underline font-medium transition-colors"
                      disabled={loading}
                    >
                      Daftar sekarang
                    </button>
                  </>
                ) : (
                  <>
                    Sudah punya akun?{' '}
                    <button
                      type="button"
                      onClick={toggleMode}
                      className="text-primary hover:underline font-medium transition-colors"
                      disabled={loading}
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </form>

            {/* OR Divider */}
            <div className="mt-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-muted-foreground font-medium tracking-widest uppercase">or</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* Google Sign In Button */}
            <Button
              type="button"
              variant="outline"
              disabled={googleLoading || loading}
              onClick={handleGoogleLogin}
              className="w-full h-10 sm:h-11 mt-3 sm:mt-4 text-sm sm:text-base font-medium border-border/50 bg-background/50 hover:bg-background/80 transition-all flex items-center justify-center gap-2 sm:gap-3"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {googleLoading ? "Redirecting to Google..." : "Continue with Google"}
            </Button>

            <div className="mt-8 pt-4 border-t border-border/30 text-center space-y-2">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Dengan melanjutkan, Anda menyetujui <a href="https://unklab-aicode.online/terms" className="text-primary hover:underline">Syarat & Ketentuan</a> dan <a href="https://unklab-aicode.online/privacy" className="text-primary hover:underline">Kebijakan Privasi</a> kami.
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
