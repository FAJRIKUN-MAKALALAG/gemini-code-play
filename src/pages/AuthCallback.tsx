import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // ✅ FIX: Guard agar handleSession hanya dipanggil SEKALI
  const handledRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const handleSession = async (session: any) => {
      // Bail jika sudah diproses atau komponen unmount
      if (!session || !isMounted || handledRef.current) return;
      handledRef.current = true; // ← LOCK: tidak akan dipanggil lagi

      try {
        // Step 1: Set HttpOnly cookies di backend
        const setSessionRes = await fetch(`${API_BASE_URL}/auth/set-session`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token ?? ''
          })
        });

        if (!setSessionRes.ok) {
          const errData = await setSessionRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to establish secure session');
        }

        // Step 2: Build user object dari Supabase session
        const user = session.user;
        const metadata = user.user_metadata || {};
        const username =
          metadata.username ||
          metadata.full_name ||
          metadata.name ||
          user.email?.split('@')[0] ||
          'User';

        // Step 3: Update React state
        login({
          id: user.id,
          email: user.email || '',
          username,
        });

        // Step 4: Bersihkan hash dari URL lalu redirect ke home
        window.history.replaceState(null, '', window.location.pathname);
        if (isMounted) navigate('/', { replace: true });

      } catch (err: any) {
        handledRef.current = false; // Reset agar error bisa di-retry
        if (isMounted) {
          console.error('[AuthCallback] Error:', err);
          setError(err?.message || 'Authentication failed. Please try again.');
        }
      }
    };

    const initAuth = async () => {
      const supabase = await getSupabaseClient();

      // Cara paling reliable: langsung getSession() saja
      // onAuthStateChange kadang fire berkali-kali — kita tidak pakai itu
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

      if (sessionErr) {
        console.error('[AuthCallback] getSession error:', sessionErr);
        if (isMounted) setError('Failed to retrieve session. Please try again.');
        return;
      }

      if (session) {
        await handleSession(session);
      } else {
        // Session tidak ada setelah menunggu — kemungkinan link sudah expired
        if (isMounted) setError('Session tidak ditemukan. Silakan login kembali.');
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []); // ← Empty deps: hanya run sekali saat komponen mount

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4">
        <div className="w-full max-w-md bg-card/50 backdrop-blur-xl border border-destructive/50 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Authentication Failed</h2>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => navigate('/') }
            className="text-sm font-semibold text-primary hover:underline"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] animate-pulse pointer-events-none" />
      <div className="relative flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-medium">Completing sign in with Google...</p>
      </div>
    </div>
  );
}
