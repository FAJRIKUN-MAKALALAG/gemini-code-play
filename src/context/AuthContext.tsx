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
  const [user, setUser] = useState<User | null>(() => authService.getUser());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      if (user) {
        const { valid, user: verifiedUser } = await authService.verifyToken();
        if (valid && verifiedUser) {
          setUser(verifiedUser);
        } else {
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    verify();
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
