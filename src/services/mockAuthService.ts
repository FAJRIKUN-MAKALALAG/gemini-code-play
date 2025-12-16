// Mock Authentication Service - Replaces Supabase Auth
// All data stored in localStorage

interface User {
  id: string;
  email: string;
  username?: string;
  created_at: string;
}

interface Session {
  user: User;
  access_token: string;
  expires_at: number;
}

interface AuthResponse {
  data: {
    user: User | null;
    session: Session | null;
  };
  error: Error | null;
}

type AuthStateChangeCallback = (event: string, session: Session | null) => void;

class MockAuthService {
  private listeners: AuthStateChangeCallback[] = [];
  private readonly STORAGE_KEY = 'mock_auth_session';
  private readonly USERS_KEY = 'mock_auth_users';

  // Get all registered users
  private getUsers(): Record<string, { email: string; password: string; username?: string; id: string; created_at: string }> {
    const users = localStorage.getItem(this.USERS_KEY);
    return users ? JSON.parse(users) : {};
  }

  // Save users
  private saveUsers(users: Record<string, any>) {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  }

  // Get current session
  private getSession(): Session | null {
    const session = localStorage.getItem(this.STORAGE_KEY);
    if (!session) return null;
    
    const parsed = JSON.parse(session);
    // Check if session expired
    if (parsed.expires_at < Date.now()) {
      this.clearSession();
      return null;
    }
    return parsed;
  }

  // Save session
  private saveSession(session: Session) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
  }

  // Clear session
  private clearSession() {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Create session for user
  private createSession(user: User): Session {
    return {
      user,
      access_token: `mock_token_${Date.now()}`,
      expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  }

  // Notify listeners
  private notifyListeners(event: string, session: Session | null) {
    this.listeners.forEach(callback => callback(event, session));
  }

  // Sign up new user
  async signUp({ email, password, options }: { 
    email: string; 
    password: string; 
    options?: { data?: { username?: string } } 
  }): Promise<AuthResponse> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const users = this.getUsers();
        
        // Check if user already exists
        if (users[email]) {
          resolve({
            data: { user: null, session: null },
            error: new Error('User already registered'),
          });
          return;
        }

        // Create new user
        const user: User = {
          id: `user_${Date.now()}`,
          email,
          username: options?.data?.username,
          created_at: new Date().toISOString(),
        };

        users[email] = {
          email,
          password, // In real app, this should be hashed
          username: options?.data?.username,
          id: user.id,
          created_at: user.created_at,
        };

        this.saveUsers(users);
        const session = this.createSession(user);
        this.saveSession(session);
        this.notifyListeners('SIGNED_IN', session);

        resolve({
          data: { user, session },
          error: null,
        });
      }, 300); // Simulate network delay
    });
  }

  // Sign in existing user
  async signInWithPassword({ email, password }: { email: string; password: string }): Promise<AuthResponse> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const users = this.getUsers();
        const userRecord = users[email];

        if (!userRecord || userRecord.password !== password) {
          resolve({
            data: { user: null, session: null },
            error: new Error('Invalid login credentials'),
          });
          return;
        }

        const user: User = {
          id: userRecord.id,
          email: userRecord.email,
          username: userRecord.username,
          created_at: userRecord.created_at,
        };

        const session = this.createSession(user);
        this.saveSession(session);
        this.notifyListeners('SIGNED_IN', session);

        resolve({
          data: { user, session },
          error: null,
        });
      }, 300); // Simulate network delay
    });
  }

  // Sign out
  async signOut(): Promise<{ error: Error | null }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.clearSession();
        this.notifyListeners('SIGNED_OUT', null);
        resolve({ error: null });
      }, 100);
    });
  }

  // Get current user
  async getUser(): Promise<{ data: { user: User | null } }> {
    return new Promise((resolve) => {
      const session = this.getSession();
      resolve({
        data: { user: session?.user || null },
      });
    });
  }

  // Get current session
  async getSessionAsync(): Promise<{ data: { session: Session | null } }> {
    return new Promise((resolve) => {
      const session = this.getSession();
      resolve({
        data: { session },
      });
    });
  }

  // Listen to auth state changes
  onAuthStateChange(callback: AuthStateChangeCallback): { data: { subscription: { unsubscribe: () => void } } } {
    this.listeners.push(callback);
    
    // Immediately call with current session
    const session = this.getSession();
    setTimeout(() => callback('INITIAL_SESSION', session), 0);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
          },
        },
      },
    };
  }
}

// Export singleton instance
export const mockAuth = new MockAuthService();
