import { useState } from "react";
import { authService } from "@/services/authService";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, User, ChevronDown, Key, Check, X, Code, MessageSquare, Columns, Settings, Moon, Sun, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "@/components/ThemeProvider";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.unklab-aicode.online/api';

export type ViewMode = "code" | "chat" | "both";

interface NavbarProps {
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onSignInClick?: () => void;
}

export const Navbar = ({ viewMode, onViewModeChange, onSignInClick }: NavbarProps) => {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth(); // <-- Use context instead of useEffect
  const userEmail = user?.email ?? null;
  const userId = user?.id ?? null;
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [editingApiKey, setEditingApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");

  // Load API key when user is available
  // Using useEffect with userId as dependency so it re-runs when user logs in
  useState(() => { if (userId) loadApiKey(userId); });

  const loadApiKey = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/keys/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setHasApiKey(data.hasKey || false);
      }
    } catch (error) {
      console.error("Failed to load API key status from backend:", error);
    }
  };

  const saveApiKey = async () => {
    if (userId && tempApiKey.trim()) {
      try {
        const response = await fetch(`${API_BASE_URL}/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, apiKey: tempApiKey.trim() })
        });
        
        if (response.ok) {
          setHasApiKey(true);
          setEditingApiKey(false);
          setTempApiKey("");
        } else {
          console.error("Failed to save API key");
        }
      } catch (error) {
        console.error("Failed to save API key:", error);
      }
    }
  };

  const startEditApiKey = () => {
    setTempApiKey("");
    setEditingApiKey(true);
  };

  const cancelEditApiKey = () => {
    setTempApiKey("");
    setEditingApiKey(false);
  };

  const handleSignOut = async () => {
    setLoading(true);
    setShowDropdown(false);
    await logout(); // Uses context logout - no page reload needed!
    setLoading(false);
  };

  return (
    <nav className="bg-background border-b border-border shadow-sm">
      <div className="max-w-[1800px] mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <Link to="/" state={{ showLanding: true }} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img
              src="/AicodeLogo.png"
              alt="AIcode Logo"
              className="w-10 h-10 dark-invert"
            />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                AI Python Coding Assistant
              </h1>
              <p className="text-xs text-muted-foreground">
                Write, run, and improve Python code with AI assistance
              </p>
            </div>
          </Link>

          {/* View Mode Toggles */}
          {onViewModeChange && viewMode && (
             <div className="hidden md:flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border absolute left-1/2 transform -translate-x-1/2">
                <Button
                  variant={viewMode === "code" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => onViewModeChange("code")}
                  title="Code Only"
                >
                  <Code className="w-4 h-4 mr-2" />
                  Code
                </Button>
                <Button
                  variant={viewMode === "both" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => onViewModeChange("both")}
                  title="Split View"
                >
                  <Columns className="w-4 h-4 mr-2" />
                  Split
                </Button>
                <Button
                  variant={viewMode === "chat" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => onViewModeChange("chat")}
                  title="Chat Only"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Chat
                </Button>
             </div>
          )}

          {/* Profile Dropdown */}
          {userEmail ? (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-ai flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-sm font-medium text-foreground">
                    {userEmail ? userEmail.split('@')[0] : 'User'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {userEmail || 'Loading...'}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDropdown(false)}
                  />
                  
                  <div className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-border bg-muted/50">
                      <div className="text-sm font-medium text-foreground">
                        Signed in as
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {userEmail}
                      </div>
                    </div>
                    
                    {/* Profile Link */}
                    <div className="p-2 border-b border-border">
                        <Link to="/profile" onClick={() => setShowDropdown(false)}>
                            <Button variant="ghost" className="w-full justify-start">
                                <Settings className="w-4 h-4 mr-2" />
                                Profile Settings
                            </Button>
                        </Link>
                    </div>

                    {/* Theme Toggle */}
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {theme === 'dark' ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-muted-foreground" />}
                            <span className="text-sm font-medium text-foreground">Appearance</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 px-0"
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        >
                            {theme === 'dark' ? (
                                <Sun className="h-4 w-4" />
                            ) : (
                                <Moon className="h-4 w-4" />
                            )}
                            <span className="sr-only">Toggle theme</span>
                        </Button>
                    </div>

                    {/* API Key Section */}
                    <div className="px-4 py-3 border-b border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Key className="w-4 h-4 text-muted-foreground" />
                        <div className="text-sm font-medium text-foreground">
                          Gemini API Key
                        </div>
                      </div>
                      
                      {!editingApiKey ? (
                        <div className="space-y-2">
                          {hasApiKey ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded border border-border flex items-center justify-between">
                                <span>••••••••••••••••</span>
                                <Check className="w-3 h-3 text-green-500" />
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={startEditApiKey}
                                className="h-8"
                              >
                                Edit
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={startEditApiKey}
                              className="w-full"
                            >
                              <Key className="w-4 h-4 mr-2" />
                              Add API Key
                            </Button>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Your API key is stored securely in the database
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            type="password"
                            placeholder="Enter your Gemini API key"
                            value={tempApiKey}
                            onChange={(e) => setTempApiKey(e.target.value)}
                            className="text-xs"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={saveApiKey}
                              disabled={!tempApiKey.trim()}
                              className="flex-1"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditApiKey}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Get your API key from{" "}
                            <a
                              href="https://aistudio.google.com/app/apikey"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              Google AI Studio
                            </a>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Logout Button */}
                    <div className="p-2">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={handleSignOut}
                        disabled={loading}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        {loading ? "Signing out..." : "Sign out"}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
             <div className="flex gap-2">
                <Button variant="default" size="sm" onClick={onSignInClick} className="shadow-lg shadow-primary/20">
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                </Button>
             </div>
          )}
        </div>
      </div>
    </nav>
  );
};

