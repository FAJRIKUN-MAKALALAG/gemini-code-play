import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authService } from "@/services/authService";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { Helmet } from "react-helmet-async";

const ResetPassword = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [visible, setVisible] = useState(false);

    // Parse tokens from URL hash (set by Supabase after user clicks email link)
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [isInvalidLink, setIsInvalidLink] = useState(false);

    useEffect(() => {
        setVisible(true);

        // Supabase puts tokens in #access_token=xxx&refresh_token=yyy&type=recovery
        const hash = window.location.hash.substring(1); // remove leading '#'
        const params = new URLSearchParams(hash);

        const at = params.get("access_token");
        const rt = params.get("refresh_token");
        const type = params.get("type");

        if (!at || type !== "recovery") {
            setIsInvalidLink(true);
        } else {
            setAccessToken(at);
            setRefreshToken(rt || at);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError("Password harus minimal 6 karakter.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Konfirmasi password tidak cocok.");
            return;
        }
        if (!accessToken) {
            setError("Token tidak valid. Gunakan link dari email Anda.");
            return;
        }

        setLoading(true);
        try {
            const { error: authError } = await authService.resetPassword(
                accessToken,
                refreshToken || accessToken,
                password
            );

            if (authError) {
                setError(authError.message || "Gagal mereset password. Coba lagi.");
            } else {
                setSuccess(true);
                // Redirect to home after 3 seconds
                setTimeout(() => navigate("/"), 3000);
            }
        } catch {
            setError("Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background overflow-hidden relative">
            <Helmet>
                <title>Reset Password — AI Code Assistant</title>
                <meta name="robots" content="noindex" />
            </Helmet>

            {/* Background blobs */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] animate-pulse pointer-events-none" />

            <div
                className={`relative w-full max-w-md mx-4 transition-all duration-500 ease-out transform ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
                    }`}
            >
                <div className="bg-card/50 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-8 text-center bg-gradient-to-b from-primary/5 to-transparent">
                        <div className="w-20 h-20 bg-background rounded-2xl shadow-lg mx-auto mb-6 flex items-center justify-center transform transition-transform hover:rotate-12 duration-500">
                            <img
                                src="/AicodeLogo.png"
                                alt="AIcode Logo"
                                className="w-16 h-16 dark-invert"
                                draggable={false}
                            />
                        </div>
                        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 mb-2">
                            Reset Password
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            {isInvalidLink
                                ? "Link tidak valid atau sudah kedaluwarsa."
                                : "Buat password baru untuk akun Anda."}
                        </p>
                    </div>

                    {/* Body */}
                    <div className="p-8 pt-0">
                        {/* Invalid link state */}
                        {isInvalidLink && (
                            <div className="flex flex-col items-center gap-4 py-4 animate-in fade-in duration-500">
                                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                                    <AlertCircle className="w-8 h-8 text-destructive" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="font-semibold text-foreground">Link Tidak Valid</p>
                                    <p className="text-sm text-muted-foreground">
                                        Link reset password ini tidak valid atau sudah kedaluwarsa.
                                        Silakan minta link baru.
                                    </p>
                                </div>
                                <Link to="/forgot-password" className="w-full">
                                    <Button className="w-full">Minta Link Baru</Button>
                                </Link>
                            </div>
                        )}

                        {/* Success state */}
                        {!isInvalidLink && success && (
                            <div className="flex flex-col items-center gap-4 py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="font-semibold text-foreground">Password Berhasil Direset!</p>
                                    <p className="text-sm text-muted-foreground">
                                        Password Anda telah diperbarui. Anda akan diarahkan ke halaman utama dalam
                                        beberapa detik...
                                    </p>
                                </div>
                                <Link to="/" className="w-full">
                                    <Button className="w-full" variant="outline">
                                        Login Sekarang
                                    </Button>
                                </Link>
                            </div>
                        )}

                        {/* Form state */}
                        {!isInvalidLink && !success && (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* Password baru */}
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password Baru</Label>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Minimal 6 karakter"
                                            value={password}
                                            onChange={(e) => { setPassword(e.target.value); setError(null); }}
                                            className="pr-10 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all"
                                            required
                                            disabled={loading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((v) => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Konfirmasi password */}
                                <div className="space-y-2">
                                    <Label htmlFor="confirm-password">Konfirmasi Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="confirm-password"
                                            type={showConfirm ? "text" : "password"}
                                            placeholder="Ulangi password baru"
                                            value={confirmPassword}
                                            onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                                            className="pr-10 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all"
                                            required
                                            disabled={loading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirm((v) => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            tabIndex={-1}
                                        >
                                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {/* Password match indicator */}
                                    {confirmPassword && (
                                        <p
                                            className={`text-xs flex items-center gap-1 animate-in fade-in duration-200 ${password === confirmPassword ? "text-green-500" : "text-muted-foreground"
                                                }`}
                                        >
                                            {password === confirmPassword ? (
                                                <><CheckCircle2 className="w-3 h-3" /> Password cocok</>
                                            ) : (
                                                "Password belum cocok"
                                            )}
                                        </p>
                                    )}
                                </div>

                                {error && (
                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                                        <p className="text-sm text-destructive">{error}</p>
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-11 text-base font-medium shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                                >
                                    {loading ? (
                                        <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Menyimpan...</>
                                    ) : (
                                        "Simpan Password Baru"
                                    )}
                                </Button>
                            </form>
                        )}

                        {/* Back to login (only show on form/invalid state) */}
                        {!success && (
                            <div className="mt-6 text-center">
                                <Link
                                    to="/"
                                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                >
                                    Kembali ke Login
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
