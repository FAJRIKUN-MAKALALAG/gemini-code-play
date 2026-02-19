import { useEffect, useState } from "react";
import { authService } from "@/services/authService";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  useEffect(() => {
    setVisible(true);
  }, []);

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return false;
    }
    if (password.length < 6) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return false;
    }
    if (mode === "signup" && !username.trim()) {
      toast({
        title: "Username Required",
        description: "Please enter a username for your account.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);

    const { error } =
      mode === "signin"
        ? await authService.login(email, password)
        : await authService.signup(email, password, username);
          
    if (error) {
      setLoading(false);
      toast({
        title: mode === "signin" ? "Sign In Failed" : "Sign Up Failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    
    setLoading(false);
    setIsExiting(true);
    toast({
      title: mode === "signin" ? "Welcome Back!" : "Account Created",
      description: mode === "signin" ? "Signing you into your workspace..." : "Your account is ready.",
    });

    setTimeout(() => {
        onAuthenticated?.();
        window.location.reload();
    }, 800);
  };

  const toggleMode = () => {
    if (loading) return;
    setMode(mode === "signin" ? "signup" : "signin");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/80 backdrop-blur-sm">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] animate-pulse-slow pointer-events-none" />

      <div
        className={`relative w-full max-w-md mx-4 transition-all duration-500 ease-out transform ${
          visible && !isExiting ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
        }`}
      >
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl overflow-hidden">
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
                    {mode === "signin" ? "Welcome Back" : "Create Account"}
                </h2>
                <p className="text-muted-foreground text-sm">
                    {mode === "signin" 
                        ? "Enter your credentials to access your workspace" 
                        : "Join us and start your AI coding journey"}
                </p>
            </div>

            <div className={`p-8 pt-0 transition-all duration-500`}>
                <form onSubmit={handleAuth} className="space-y-5">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all"
                                required
                                disabled={loading}
                            />
                        </div>

                        {mode === "signup" && (
                            <div className="space-y-2 animate-in slide-in-from-left-4 fade-in duration-500">
                                <Label htmlFor="username">Username</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="Display Name"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all"
                                required
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading }
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
                        type="button"
                        onClick={toggleMode}
                        disabled={loading}
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
