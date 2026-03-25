import { API_BASE_URL } from "@/config";
import { getSupabaseClient } from "@/lib/supabaseClient";

export interface User {
  id: string;
  email: string;
  username?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  user: User;
}

// ── Cached user so we don't hit /api/me on every isAuthenticated() check ──────
let cachedUser: User | null = null;

class AuthService {
  // ===== SIGNUP =====
  async signup(email: string, password: string, username?: string): Promise<{ session: AuthSession | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username })
      });

      if (!response.ok) {
        let errorMessage = 'Signup failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = await response.text() || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!data.session || !data.user) throw new Error('Invalid response from backend');

      const session: AuthSession = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        user: { id: data.user.id, email: data.user.email, username: data.user.username }
      };

      await this.saveSession(session);
      return { session, error: null };
    } catch (error) {
      console.error('Signup error:', error);
      return { session: null, error: error as Error };
    }
  }

  // ===== LOGIN =====
  async login(email: string, password: string): Promise<{ session: AuthSession | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        let errorMessage = 'Login failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = await response.text() || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!data.session || !data.user) throw new Error('Invalid response from backend');

      const session: AuthSession = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        user: { id: data.user.id, email: data.user.email, username: data.user.username }
      };

      await this.saveSession(session);
      return { session, error: null };
    } catch (error) {
      console.error('Login error:', error);
      return { session: null, error: error as Error };
    }
  }

  // ===== LOGOUT =====
  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
        // Backend baru langsung baca cookie — tidak perlu kirim Bearer
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }

    cachedUser = null;
    // Also call clear-session as a belt-and-suspenders cleanup
    try {
      await fetch(`${API_BASE_URL}/auth/clear-session`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (_) {}
  }

  // ===== VERIFY TOKEN (via /api/me) =====
  async verifyToken(): Promise<{ valid: boolean; user: User | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/me`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        // Backend auto-refreshes inside requireAuth.
        // If still failing, session is truly dead.
        cachedUser = null;
        return { valid: false, user: null };
      }

      const data = await response.json();
      const user: User = { id: data.id, email: data.email, username: data.username };
      cachedUser = user;
      return { valid: true, user };
    } catch (error) {
      return { valid: false, user: null };
    }
  }

  // ===== REFRESH TOKEN =====
  // Backend reads refresh_token from cookie — frontend sends NO body
  async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include'
        // No body needed — backend reads refresh_token from HttpOnly cookie
      });

      if (!response.ok) {
        cachedUser = null;
        return false;
      }

      // Backend updated the cookies server-side; re-fetch /api/me to refresh cachedUser
      await this.verifyToken();
      return true;
    } catch (error) {
      cachedUser = null;
      return false;
    }
  }

  // ===== GOOGLE OAUTH =====
  async loginWithGoogle(): Promise<{ error: Error | null }> {
    try {
      window.location.href = `${API_BASE_URL}/auth/google/login`;
      return { error: null };
    } catch (error) {
      console.error('Google OAuth error:', error);
      return { error: error as Error };
    }
  }

  // ===== FORGOT PASSWORD =====
  async forgotPassword(email: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send reset email');
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Forgot password error:', error);
      return { success: false, error: error as Error };
    }
  }

  // ===== RESET PASSWORD =====
  async resetPassword(access_token: string, refresh_token: string, newPassword: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token, refresh_token, password: newPassword })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reset password');
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: error as Error };
    }
  }

  // ===== SESSION MANAGEMENT (COOKIE BASED) =====

  // Backend contract: only access_token + refresh_token. No user object (prevents spoofing).
  private async saveSession(session: AuthSession): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/set-session`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token
          // Do NOT send user — backend validates token with Supabase itself
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'set-session rejected');
      }

      // Cache user from session passed in (already validated by login/signup endpoint)
      cachedUser = session.user;
    } catch (error) {
      console.error('saveSession via backend failed:', error);
      throw error; // Propagate so login knows it failed
    }
  }

  // ===== USER & AUTH STATE =====

  // Synchronous check via cache — returns last known user without network call
  getUser(): User | null {
    return cachedUser;
  }

  // Async: hits /api/me to get fresh user data from server  
  async fetchCurrentUser(): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/me`, {
        method: 'GET',
        credentials: 'include'
      });
      if (!response.ok) {
        cachedUser = null;
        return null;
      }
      const data = await response.json();
      cachedUser = { id: data.id, email: data.email, username: data.username };
      return cachedUser;
    } catch {
      return null;
    }
  }

  // Warm up the cache on app startup — call this once in App.tsx or Index.tsx
  async initSession(): Promise<User | null> {
    return this.fetchCurrentUser();
  }

  isAuthenticated(): boolean {
    // Relies on cachedUser. Call initSession() on app boot to warm it up.
    return !!cachedUser;
  }

  // Access token is HttpOnly — not readable by JS. Return empty for Bearer compat.
  // credentials: 'include' in fetch calls handles sending the cookie automatically.
  getAccessToken(): string | null {
    return null; // Intentionally null — token is in HttpOnly cookie, inaccessible to JS
  }

  getAuthHeaders(): Record<string, string> {
    // credentials: 'include' handles cookie attachment automatically
    // Return empty object since all auth goes via cookie now
    return {};
  }
}

export const authService = new AuthService();
