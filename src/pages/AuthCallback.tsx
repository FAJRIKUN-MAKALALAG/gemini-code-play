import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { safeLocalStorage } from '@/utils/storageUtils';
import { API_BASE_URL } from '@/config';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = await getSupabaseClient();

        // Get session that Supabase set after Google OAuth redirect
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          throw new Error(sessionError?.message || 'No session found. Please try signing in again.');
        }

        // Sync Google user profile to backend database
        const response = await fetch(`${API_BASE_URL}/auth/google/callback`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to sync profile with backend');
        }

        const data = await response.json();
        const user = data.user;

        // Save session to localStorage (same keys as email/password login)
        safeLocalStorage.setItem('access_token', session.access_token);
        safeLocalStorage.setItem('refresh_token', session.refresh_token ?? '');
        safeLocalStorage.setItem('expires_at', session.expires_at?.toString() ?? '');
        safeLocalStorage.setItem('user_id', user.id);
        safeLocalStorage.setItem('user_email', user.email);
        if (user.username) {
          safeLocalStorage.setItem('user_username', user.username);
        }

        // Update React auth state
        login({
          id: user.id,
          email: user.email,
          username: user.username,
        });

        // Redirect to home
        navigate('/', { replace: true });
      } catch (err: any) {
        console.error('[AuthCallback] Error:', err);
        setError(err?.message || 'Authentication failed. Please try again.');
      }
    };

    handleCallback();
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
