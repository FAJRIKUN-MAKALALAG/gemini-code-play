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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);

    const { session, error } =
      mode === "signin"
        ? await authService.login(email, password)
        : await authService.signup(email, password, username);
          
    setLoading(false);
    
    if (error) {
      console.error("Auth Error:", error);
      toast({
        title: mode === "signin" ? "Sign In Failed" : "Sign Up Failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    
    // Success animation before closing
    setIsExiting(true);
    setTimeout(() => {
        onAuthenticated?.();
    }, 500);
  };

  const toggleMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/80 backdrop-blur-sm">
      {/* Background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] animate-pulse-slow pointer-events-none" />

      <div
        className={`relative w-full max-w-md mx-4 transition-all duration-500 ease-out transform ${
          visible && !isExiting ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
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
                    {mode === "signin" ? "Welcome Back" : "Create Account"}
                </h2>
                <p className="text-muted-foreground">
                    {mode === "signin" 
                        ? "Enter your credentials to access your workspace" 
                        : "Join us and start your AI coding journey"}
                </p>
            </div>

            {/* Form */}
            <div className={`p-8 pt-0 transition-all duration-500`}>
                <form onSubmit={handleAuth} className="space-y-5">
                    <div className="space-y-4">
                         {/* Email Field - Always visible */}
                        <div className="space-y-2 animate-in slide-in-from-left-4 fade-in duration-500 delay-100">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all"
                                required
                            />
                        </div>

                        {/* Username Field - Only for Signup */}
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
                                />
                            </div>
                        )}

                        {/* Password Field - Always visible */}
                        <div className="space-y-2 animate-in slide-in-from-left-4 fade-in duration-500 delay-200">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all"
                                required
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading }
                        className="w-full h-11 text-lg font-medium shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all animate-in slide-in-from-bottom-4 fade-in duration-500 delay-300"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : (
                            mode === "signin" ? "Sign In" : "Create Account"
                        )}
                    </Button>
                </form>

                <div className="mt-6 text-center animate-in fade-in duration-700 delay-500">
                    <span className="text-sm text-muted-foreground">
                        {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
                    </span>
                    <button
                        type="button"
                        onClick={toggleMode}
                        className="text-sm font-semibold text-primary hover:underline focus:outline-none transition-colors"
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
