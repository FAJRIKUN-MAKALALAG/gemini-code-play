import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { authService, User } from "@/services/authService";
import { clearCachedApiKey } from "@/services/geminiService";

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // On every app load, hit /api/me to see if the browser still has a valid session cookie.
    // This replaces the old localStorage-based check.
    const init = async () => {
      try {
        const verifiedUser = await authService.initSession();
        setUser(verifiedUser);
      } catch (e) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    await authService.logout();
    clearCachedApiKey(); // clear in-memory Gemini key cache
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
