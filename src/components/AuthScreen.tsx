import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AuthScreenProps {
  onAuthenticated?: () => void;
}

export const AuthScreen = ({ onAuthenticated }: AuthScreenProps) => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  const handleAuth = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { data, error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { username } },
          });
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    onAuthenticated?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
      <div
        className={`w-full max-w-md mx-auto px-6 py-8 border border-border rounded-xl shadow-card transition-all duration-700 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <div className="text-center mb-6">
          <img src="/AicodeLogo.png" alt="AIcode Logo" className="w-16 h-16 mx-auto mb-3" />
          <h2 className="text-xl font-semibold">Welcome to AIcode</h2>
          <p className="text-sm text-muted-foreground">Sign in to save your chats and continue where you left off.</p>
        </div>
        <div className="flex gap-2 mb-4">
          <Button
            variant={mode === "signin" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("signin")}
            className="flex-1"
          >
            Sign In
          </Button>
          <Button
            variant={mode === "signup" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("signup")}
            className="flex-1"
          >
            Create Account
          </Button>
        </div>
        <div className="space-y-3">
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "signup" && (
            <Input
              placeholder="Username (display name)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}
          <Button onClick={handleAuth} disabled={loading || !email || !password} className="w-full">
            {mode === "signin" ? "Sign In" : "Create Account"}
          </Button>
        </div>
      </div>
    </div>
  );
};
