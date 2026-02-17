// Backend Authentication Service
// Replaces Supabase client-side auth with backend API calls

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.unklab-aicode.online/api';

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Signup failed');
      }

      const data = await response.json();
      console.log('Backend signup response:', data);
      
      // Backend returns { user, session } directly
      if (!data.session || !data.user) {
        throw new Error('Invalid response from backend');
      }
      
      // Construct proper session object
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
      
      this.saveSession(session);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Login failed');
      }

      const data = await response.json();
      console.log('Backend login response:', data);
      
      // Backend returns { user, session } directly
      if (!data.session || !data.user) {
        throw new Error('Invalid response from backend');
      }
      
      // Construct proper session object
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
      
      this.saveSession(session);
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
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
    
    this.clearSession();
  }

  // ===== VERIFY TOKEN =====
  async verifyToken(): Promise<{ valid: boolean; user: User | null }> {
    const token = this.getAccessToken();
    if (!token) return { valid: false, user: null };

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        // Try to refresh token
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token })
      });

      if (!response.ok) {
        this.clearSession();
        return false;
      }

      const data = await response.json();
      this.saveSession(data.session);
      return true;
    } catch (error) {
      this.clearSession();
      return false;
    }
  }

  // ===== SESSION MANAGEMENT =====
  private saveSession(session: AuthSession): void {
    localStorage.setItem('access_token', session.access_token);
    localStorage.setItem('refresh_token', session.refresh_token);
    localStorage.setItem('user_id', session.user.id);
    localStorage.setItem('user_email', session.user.email);
    if (session.user.username) {
      localStorage.setItem('user_username', session.user.username);
    }
    localStorage.setItem('expires_at', session.expires_at.toString());
  }

  private clearSession(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_username');
    localStorage.removeItem('expires_at');
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  getUser(): User | null {
    const id = localStorage.getItem('user_id');
    const email = localStorage.getItem('user_email');
    const username = localStorage.getItem('user_username');

    if (!id || !email) return null;

    return { id, email, username: username || undefined };
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  // ===== HELPER FOR API REQUESTS =====
  getAuthHeaders(): Record<string, string> {
    const token = this.getAccessToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
}

export const authService = new AuthService();
