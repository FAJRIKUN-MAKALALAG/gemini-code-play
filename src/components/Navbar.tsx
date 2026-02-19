import { useState, useEffect } from "react";
import { authService } from "@/services/authService";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, User, ChevronDown, Key, Check, X, Code, MessageSquare, Columns, Settings, Moon, Sun, LogIn, ExternalLink, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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

  const loadApiKey = async (uid: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/keys/${uid}`);
      if (response.ok) {
        const data = await response.json();
        setHasApiKey(data.hasKey || false);
      }
    } catch (error) {
      console.error("Failed to load API key status from backend:", error);
    }
  };

  // Load API key whenever user changes (e.g. after login)
  useEffect(() => {
    if (userId) loadApiKey(userId);
  }, [userId]);

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
                AI Coding Assistant
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 group p-1.5 rounded-full border border-border/50 hover:bg-muted/50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <Avatar className="h-8 w-8 border border-border/50 shadow-sm transition-transform group-hover:scale-105">
                    <AvatarFallback className="bg-gradient-ai text-white text-xs font-bold">
                      {userEmail ? userEmail.substring(0, 2).toUpperCase() : 'AI'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden md:block px-1">
                    <div className="text-xs font-semibold text-foreground line-clamp-1">
                      {userEmail?.split('@')[0]}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform group-hover:text-foreground" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-72 p-0 rounded-xl overflow-hidden shadow-2xl border-border/50 bg-popover/95 backdrop-blur-xl">
                {/* User Info Header */}
                <div className="bg-secondary/30 px-4 py-4 space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Signed in as</p>
                  <p className="text-sm font-semibold truncate text-foreground">{userEmail}</p>
                </div>

                <div className="p-1.5 space-y-0.5">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-lg focus:bg-accent group">
                      <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <Settings className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">Profile Settings</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="flex items-center justify-between cursor-pointer py-2.5 px-3 rounded-lg focus:bg-accent group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-muted p-2 rounded-lg group-hover:bg-accent transition-colors">
                        {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      </div>
                      <span className="text-sm font-medium">Appearance</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground mr-1">{theme}</span>
                  </DropdownMenuItem>
                </div>

                <DropdownMenuSeparator className="bg-border/50" />

                {/* API Key Section */}
                <div className="px-4 py-4 space-y-3 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Key className="w-3.5 h-3.5 text-primary" />
                       <span className="text-xs font-bold text-foreground">Gemini API Key</span>
                    </div>
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[10px] text-primary hover:underline flex items-center gap-1"
                    >
                      Get Key <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  {!editingApiKey ? (
                    <div className="space-y-2">
                      {hasApiKey ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 text-[10px] font-mono bg-background/50 backdrop-blur-sm px-3 py-2 rounded-lg border border-border/50 flex items-center justify-between">
                            <span className="text-muted-foreground opacity-50">••••••••••••••••</span>
                            <Check className="w-3 h-3 text-green-500" />
                          </div>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); startEditApiKey(); }} className="h-8 text-[10px] border-border/50 font-bold hover:bg-background">
                            EDIT
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); startEditApiKey(); }} className="w-full h-9 border-dashed border-primary/30 text-primary hover:bg-primary/5 font-bold">
                          <Plus className="w-3.5 h-3.5 mr-2" /> ADD API KEY
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="password"
                        placeholder="Enter Key..."
                        value={tempApiKey}
                        onChange={(e) => setTempApiKey(e.target.value)}
                        className="h-8 text-xs bg-background"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveApiKey} disabled={!tempApiKey.trim()} className="flex-1 h-8 text-[10px] font-bold">
                          SAVE
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditApiKey} className="h-8 w-8 p-0">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <DropdownMenuSeparator className="bg-border/50" />

                {/* Logout Button */}
                <div className="p-1.5">
                  <DropdownMenuItem 
                    onClick={handleSignOut}
                    disabled={loading}
                    className="flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive group"
                  >
                    <div className="bg-destructive/5 p-2 rounded-lg group-hover:bg-destructive/10 transition-colors">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold">{loading ? "Signing out..." : "Sign Out"}</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
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

