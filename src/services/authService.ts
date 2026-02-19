import { safeLocalStorage } from "@/utils/storageUtils";
import { API_BASE_URL } from "@/config";

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
    safeLocalStorage.setItem('access_token', session.access_token);
    safeLocalStorage.setItem('refresh_token', session.refresh_token);
    safeLocalStorage.setItem('user_id', session.user.id);
    safeLocalStorage.setItem('user_email', session.user.email);
    if (session.user.username) {
      safeLocalStorage.setItem('user_username', session.user.username);
    }
    safeLocalStorage.setItem('expires_at', session.expires_at.toString());
  }

  private clearSession(): void {
    safeLocalStorage.removeItem('access_token');
    safeLocalStorage.removeItem('refresh_token');
    safeLocalStorage.removeItem('user_id');
    safeLocalStorage.removeItem('user_email');
    safeLocalStorage.removeItem('user_username');
    safeLocalStorage.removeItem('expires_at');
  }

  getAccessToken(): string | null {
    return safeLocalStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return safeLocalStorage.getItem('refresh_token');
  }

  getUser(): User | null {
    const id = safeLocalStorage.getItem('user_id');
    const email = safeLocalStorage.getItem('user_email');
    const username = safeLocalStorage.getItem('user_username');

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
