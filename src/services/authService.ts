import { API_BASE_URL } from "@/config";
import { getSupabaseClient } from "@/lib/supabaseClient";
import Cookies from "js-cookie";

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
          const textError = await response.text();
          errorMessage = textError || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Backend signup response:', data);

      if (!data.session || !data.user) {
        throw new Error('Invalid response from backend');
      }

      const session: AuthSession = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        user: {
          id: data.user.id,
          email: data.user.email,
          username: data.user.username
        }
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
          const textError = await response.text();
          errorMessage = textError || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Backend login response:', data);

      if (!data.session || !data.user) {
        throw new Error('Invalid response from backend');
      }

      const session: AuthSession = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        user: {
          id: data.user.id,
          email: data.user.email,
          username: data.user.username
        }
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
    const token = this.getAccessToken();

    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }

    await this.clearSession();
  }

  // ===== VERIFY TOKEN =====
  async verifyToken(): Promise<{ valid: boolean; user: User | null }> {
    const token = this.getAccessToken();
    if (!token) return { valid: false, user: null };

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return { valid: true, user: this.getUser() };
        }
        return { valid: false, user: null };
      }

      return { valid: true, user: this.getUser() };
    } catch (error) {
      return { valid: false, user: null };
    }
  }

  // ===== REFRESH TOKEN =====
  async refreshToken(): Promise<boolean> {
    const refresh_token = this.getRefreshToken();
    if (!refresh_token) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token })
      });

      if (!response.ok) {
        await this.clearSession();
        return false;
      }

      const data = await response.json();
      await this.saveSession(data.session);
      return true;
    } catch (error) {
      await this.clearSession();
      return false;
    }
  }

  // ===== GOOGLE OAUTH =====
  async loginWithGoogle(): Promise<{ error: Error | null }> {
    try {
      // Direct redirect to backend custom Google OAuth endpoint
      // This allows the backend to control the branding and domain
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

  private async saveSession(session: AuthSession): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/auth/set-session`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          access_token: session.access_token, 
          refresh_token: session.refresh_token, 
          user: session.user 
        })
      });
    } catch (error) {
      console.warn('Failed to securely save session cookies via backend', error);
      // Fallback manual approach if endpoint not ready
      const inOneHour = 1 / 24;
      Cookies.set('access_token', session.access_token, { expires: inOneHour, sameSite: 'strict', secure: true });
      Cookies.set('refresh_token', session.refresh_token, { expires: inOneHour, sameSite: 'strict', secure: true });
      Cookies.set('user_data', JSON.stringify(session.user), { expires: inOneHour, sameSite: 'strict', secure: true });
    }
  }

  private async clearSession(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/auth/clear-session`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {}

    // Fallback purely frontend side
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    Cookies.remove('user_data');
    Cookies.remove('user_id');
    Cookies.remove('user_email');
    Cookies.remove('user_username');
    Cookies.remove('expires_at');
  }

  getAccessToken(): string | null {
    // If HttpOnly cookie is completely adopted, this will return undefined.
    return Cookies.get('access_token') || null;
  }

  getRefreshToken(): string | null {
    return Cookies.get('refresh_token') || null;
  }

  getUser(): User | null {
    // Rely on user_data cookie parsing
    const userData = Cookies.get('user_data');
    if (userData) {
      try {
        const parsed = JSON.parse(decodeURIComponent(userData));
        if (parsed && typeof parsed === 'object') {
          return { id: parsed.id, email: parsed.email, username: parsed.username };
        }
      } catch (e) {
        // format is incorrectly formed, allow fallback to legacy storage temporarily
      }
    }

    // Fallback if user_data wasn't set, try reading legacy loose cookies
    const id = Cookies.get('user_id');
    const email = Cookies.get('user_email');
    const username = Cookies.get('user_username');
    if (!id || !email) return null;

    return { id, email, username: username || undefined };
  }

  isAuthenticated(): boolean {
    return !!this.getUser();
  }

  // ===== HELPER FOR API REQUESTS =====
  getAuthHeaders(): Record<string, string> {
    const token = this.getAccessToken();
    // Return empty since credentials: 'include' will handle sending HttpOnly cookies.
    // However, as a graceful fallback during transition, send Bearer if access_token is accessible
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
}

export const authService = new AuthService();

