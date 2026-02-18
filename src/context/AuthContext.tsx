import { createContext, useContext, useState, ReactNode } from "react";
import { authService, User } from "@/services/authService";

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Lazy initialization: reads from localStorage synchronously on first render.
  // This fixes the page-refresh redirect issue.
  const [user, setUser] = useState<User | null>(() => authService.getUser());

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
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
