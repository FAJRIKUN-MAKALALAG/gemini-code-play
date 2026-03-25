import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let authListener: any = null;

    const handleSession = async (session: any) => {
      if (!session || !isMounted) return;

      try {
        // Step 1: Sync Google profile to backend database AND set HttpOnly cookies
        const response = await fetch(`${API_BASE_URL}/auth/google/callback`, {
          method: 'POST',
          credentials: 'include', // REQUIRED: allows backend Set-Cookie header to be accepted
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to sync profile with backend');
        }

        // Step 2: Ask backend to set secure HttpOnly cookies
        // Backend contract: only access_token + refresh_token (no user object)
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

        // Step 3: Build user object from Supabase session (already validated above)
        const user = session.user;
        const username =
          user.user_metadata?.username ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name;

        // Step 4: Update React auth state (no localStorage needed anymore)
        login({
          id: user.id,
          email: user.email,
          username: username,
        });

        // Step 5: Redirect to home
        navigate('/', { replace: true });
      } catch (err: any) {
        if (isMounted) {
          console.error('[AuthCallback] Error:', err);
          setError(err?.message || 'Authentication failed. Please try again.');
        }
      }
    };

    const initAuth = async () => {
      const supabase = await getSupabaseClient();

      // 1. Manually check URL hash (fragment) in case onAuthStateChange hasn't fired yet
      const hash = window.location.hash;
      if (hash && hash.includes('access_token=')) {
        try {
          // Use Supabase helper to parse the session from hash
          const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
          if (session && !sessionErr) {
            console.log('[AuthCallback] Session found in hash, processing...');
            await handleSession(session);
            return; // Exit as handled
          }
        } catch (e) {
          console.warn('[AuthCallback] Manual hash parse failed:', e);
        }
      }

      // 2. Listen for the initial session or sign-in event
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          await handleSession(session);
        }
      });

      authListener = subscription;

      // 3. Also check if there's already a session available immediately
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await handleSession(session);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      if (authListener) authListener.unsubscribe();
    };
  }, [login, navigate]);

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
            onClick={() => navigate('/', { replace: true })}
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
      {/* Background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] animate-pulse pointer-events-none" />

      <div className="relative flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-medium">Completing sign in with Google...</p>
      </div>
    </div>
  );
}
