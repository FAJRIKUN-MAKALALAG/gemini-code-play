import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const AuthPanel = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    setLoading(false);
  };

  const signUp = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    setLoading(false);
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  };

  if (userEmail) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 mb-3 flex items-center justify-between">
        <div className="text-sm">
          Signed in as <span className="font-medium">{userEmail}</span>
        </div>
        <Button size="sm" variant="outline" onClick={signOut} disabled={loading}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3 mb-3">
      <div className="text-sm font-medium mb-2">Sign in</div>
      <div className="flex gap-2 mb-2">
        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={signIn} disabled={loading || !email || !password}>Sign in</Button>
        <Button size="sm" variant="outline" onClick={signUp} disabled={loading || !email || !password}>Sign up</Button>
      </div>
    </div>
  );
};
