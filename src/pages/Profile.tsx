import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Key, Mail, User, Moon, Sun, ChevronLeft, Shield, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/config";

const Profile = () => {
    const { theme, setTheme } = useTheme();
    const { user, updateUser, isLoading: isAuthLoading } = useAuth();
    const [isEditingKey, setIsEditingKey] = useState(false);
    const [tempKey, setTempKey] = useState("");
    
    // Username edit states
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [tempUsername, setTempUsername] = useState("");
    const [isSavingUsername, setIsSavingUsername] = useState(false);

    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    const { data: apiKeyData, isLoading: isLoadingKey } = useQuery({
        queryKey: ["apiKeyStatus", user?.id],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/keys/${user?.id}`, {
                credentials: 'include'
            });
            if (!response.ok) return { hasKey: false };
            return response.json();
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 5, // Cache selama 5 menit
    });

    useEffect(() => {
        if (!isAuthLoading && !user) {
            navigate("/");
        } else if (user) {
            // Initiate tempUsername based on the globally synced user Context
            setTempUsername(user.username || "");
        }
    }, [user, isAuthLoading, navigate]);

    const hasApiKey = apiKeyData?.hasKey || false;
    const apiKeySuffix = apiKeyData?.suffix || "";

    const handleSaveKey = async () => {
        if (user && tempKey.trim()) {
            try {
                const response = await fetch(`${API_BASE_URL}/keys`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ apiKey: tempKey.trim() })  // userId diambil dari token
                });

                if (response.ok) {
                    setIsEditingKey(false);
                    setTempKey("");
                    toast({ title: "API Key Saved", description: "Your Gemini API key has been saved to the database." });
                    // Invalidate and refetch to update UI
                    window.location.reload(); // Quick fix to refresh the query status or use queryClient.invalidateQueries
                } else {
                    const error = await response.text();
                    toast({ title: "Save Failed", description: error, variant: "destructive" });
                }
            } catch (error) {
                console.error("Failed to save API key:", error);
                toast({ title: "Error", description: "Failed to connect to backend", variant: "destructive" });
            }
        }
    };

    const handleSaveUsername = async () => {
        if (!user || !tempUsername.trim()) return;

        setIsSavingUsername(true);
        try {
            const { user: updatedUser, error } = await authService.updateProfile(tempUsername.trim());
            if (error) throw error;
            
            if (updatedUser) {
                updateUser(updatedUser); // Update the global context instantly
                setIsEditingUsername(false);
                toast({ title: "Profile Updated", description: "Your username has been updated successfully." });
            }
        } catch (error: any) {
            console.error("Failed to update profile:", error);
            toast({ title: "Save Failed", description: error.message || "Failed to update profile", variant: "destructive" });
        } finally {
            setIsSavingUsername(false);
        }
    };

    const handleLogout = async () => {
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try {
            await authService.logout();
            navigate("/");
        } catch (error) {
            console.error('Logout failed:', error);
            toast({ title: 'Logout Gagal', description: 'Terjadi kesalahan saat logout. Coba lagi.', variant: 'destructive' });
            setIsLoggingOut(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
                        <p className="text-muted-foreground">Manage your account settings and preferences.</p>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* Main Profile Card */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Profile Information</CardTitle>
                            <CardDescription>Update your personal details.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center gap-6">
                                <Avatar className="h-24 w-24">
                                    <AvatarImage src={user.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${user.email}`} />
                                    <AvatarFallback>{user.username?.substring(0, 2).toUpperCase() || "US"}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="text-lg font-medium">{user.username || "User"}</h3>
                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-6">
                                <div className="grid gap-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">Username</label>
                                        {!isEditingUsername && (
                                            <Button variant="ghost" size="sm" onClick={() => setIsEditingUsername(true)} className="h-6 text-xs px-2">
                                                Edit
                                            </Button>
                                        )}
                                    </div>
                                    
                                    {!isEditingUsername ? (
                                        <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/50">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm font-medium">{user.username || "Not set"}</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        value={tempUsername}
                                                        onChange={(e) => setTempUsername(e.target.value)}
                                                        className="pl-9"
                                                        placeholder="Enter new username"
                                                        disabled={isSavingUsername}
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-2 justify-end mt-1">
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    onClick={() => {
                                                        setIsEditingUsername(false);
                                                        setTempUsername(user.username || "");
                                                    }}
                                                    disabled={isSavingUsername}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    onClick={handleSaveUsername}
                                                    disabled={isSavingUsername || !tempUsername.trim() || tempUsername === user.username}
                                                >
                                                    {isSavingUsername ? "Saving..." : "Save"}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Email Address</label>
                                    <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/50">
                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm">{user.email}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Sidebar Actions */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Appearance</CardTitle>
                                <CardDescription>Customize your interface theme.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {theme === 'dark' ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-muted-foreground" />}
                                        <span className="text-sm font-medium">Theme Preference</span>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                    >
                                        {theme === 'dark' ? "Dark Mode" : "Light Mode"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>API Configuration</CardTitle>
                                <CardDescription>Manage your Gemini API Key.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {!isEditingKey ? (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-muted rounded-md border text-xs font-mono break-all flex items-center justify-between gap-2">
                                            <span className="flex-1 min-w-0 truncate">
                                                {hasApiKey
                                                    ? `${"•".repeat(28)}${apiKeySuffix || "••••"}`
                                                    : "No API Key Set"}
                                            </span>
                                            {hasApiKey && (
                                                <span className="text-green-600 text-xs shrink-0">✓ Saved</span>
                                            )}
                                        </div>
                                        <Button onClick={() => { setTempKey(""); setIsEditingKey(true); }} className="w-full" variant="outline">
                                            <Key className="w-4 h-4 mr-2" />
                                            {hasApiKey ? "Update Key" : "Add Key"}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <Input
                                            placeholder="Paste API Key here"
                                            value={tempKey}
                                            onChange={(e) => setTempKey(e.target.value)}
                                            type="password"
                                        />
                                        <div className="flex gap-2">
                                            <Button onClick={handleSaveKey} className="flex-1">Save</Button>
                                            <Button variant="ghost" onClick={() => setIsEditingKey(false)}>Cancel</Button>
                                        </div>
                                    </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Keys are stored securely in your browser's local storage.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Account Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button variant="outline" disabled={isLoggingOut} className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleLogout}>
                                    <LogOut className="w-4 h-4 mr-2" />
                                    {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
