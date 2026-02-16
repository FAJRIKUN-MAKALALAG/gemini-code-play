import { useState, useEffect } from "react";
import { mockAuth } from "@/services/mockAuthService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, User, ChevronDown, Key, Check, X, Code, MessageSquare, Columns, Settings, Moon, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "@/components/ThemeProvider";

export type ViewMode = "code" | "chat" | "both";

interface NavbarProps {
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export const Navbar = ({ viewMode, onViewModeChange }: NavbarProps) => {
  const { theme, setTheme } = useTheme();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [editingApiKey, setEditingApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");

  useEffect(() => {
    mockAuth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
      if (data.user?.id) {
        loadApiKey(data.user.id);
      }
    });
    const { data: sub } = mockAuth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);
      if (session?.user?.id) {
        loadApiKey(session.user.id);
      } else {
        setApiKey("");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadApiKey = (userId: string) => {
    const stored = localStorage.getItem(`gemini_api_key_${userId}`);
    if (stored) {
      setApiKey(stored);
    }
  };

  const saveApiKey = () => {
    if (userId && tempApiKey.trim()) {
      localStorage.setItem(`gemini_api_key_${userId}`, tempApiKey.trim());
      setApiKey(tempApiKey.trim());
      setEditingApiKey(false);
      setTempApiKey("");
    }
  };

  const startEditApiKey = () => {
    setTempApiKey(apiKey);
    setEditingApiKey(true);
  };

  const cancelEditApiKey = () => {
    setTempApiKey("");
    setEditingApiKey(false);
  };

  const handleSignOut = async () => {
    setLoading(true);
    await mockAuth.signOut();
    setLoading(false);
    setShowDropdown(false);
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key;
    return key.substring(0, 4) + "•".repeat(key.length - 8) + key.substring(key.length - 4);
  };

  return (
    <nav className="bg-background border-b border-border shadow-sm">
      <div className="max-w-[1800px] mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center gap-3">
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
          </div>

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
          {userEmail && (
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
                    {userEmail.split('@')[0]}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {userEmail}
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
                          {apiKey ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded border border-border">
                                {maskApiKey(apiKey)}
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
                            Your API key is stored locally and never shared
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
          )}
        </div>
      </div>
    </nav>
  );
};

