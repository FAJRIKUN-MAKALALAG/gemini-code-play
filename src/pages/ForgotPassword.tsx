import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { authService } from "@/services/authService";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { Helmet } from "react-helmet-async";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(true);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError("Masukkan alamat email yang valid.");
            return;
        }

        setLoading(true);
        try {
            const { error: authError } = await authService.forgotPassword(email);
            if (authError) {
                setError(authError.message || "Gagal mengirim email. Coba lagi.");
            } else {
                setSent(true);
            }
        } catch {
            setError("Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-background">
            <Helmet>
                <title>Lupa Password — AI Coding Assistant</title>
                <meta name="robots" content="noindex" />
            </Helmet>

            <div className="min-h-full w-full flex flex-col items-center justify-center py-6 sm:py-12 relative">
                {/* Background blobs */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] animate-pulse" />
                </div>

                <div
                    className={`relative z-10 w-full max-w-md mx-4 transition-all duration-500 ease-out transform ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
                        }`}
                >
                <div className="bg-card/50 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-6 sm:p-8 text-center bg-gradient-to-b from-primary/5 to-transparent">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-background rounded-2xl shadow-lg mx-auto mb-4 sm:mb-6 flex items-center justify-center transform transition-transform hover:rotate-12 duration-500">
                            <img
                                src="/AicodeLogo.png"
                                alt="AIcode Logo"
                                className="w-12 h-12 sm:w-16 sm:h-16 dark-invert"
                                draggable={false}
                            />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 mb-1 sm:mb-2 text-balance leading-tight">
                            Lupa Password
                        </h2>
                        <p className="text-muted-foreground text-[13px] sm:text-sm px-2">
                            Masukkan email akun Anda dan kami akan kirimkan link reset password.
                        </p>
                    </div>

                    {/* Body */}
                    <div className="p-6 sm:p-8 pt-0">
                        {sent ? (
                            /* ── Success State ── */
                            <div className="flex flex-col items-center gap-4 py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="font-semibold text-foreground">Email Terkirim!</p>
                                    <p className="text-sm text-muted-foreground">
                                        Cek inbox <span className="text-primary font-medium">{email}</span> dan klik
                                        link yang dikirimkan untuk reset password Anda.
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Tidak menerima email? Cek folder Spam atau coba lagi.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="mt-2 w-full"
                                    onClick={() => { setSent(false); setEmail(""); }}
                                >
                                    Kirim Ulang
                                </Button>
                            </div>
                        ) : (
                            /* ── Form State ── */
                            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="name@example.com"
                                            value={email}
                                            onChange={(e) => { setEmail(e.target.value); setError(null); }}
                                            className="pl-9 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all text-base sm:text-sm"
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                    {error && (
                                        <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                                            {error}
                                        </p>
                                    )}
                                </div>

                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-10 sm:h-11 text-sm sm:text-base font-medium shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                                >
                                    {loading ? (
                                        <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Mengirim...</>
                                    ) : (
                                        "Kirim Link Reset"
                                    )}
                                </Button>
                            </form>
                        )}

                        {/* Back to login */}
                        <div className="mt-6 text-center">
                            <Link
                                to="/"
                                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Kembali ke Login
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
