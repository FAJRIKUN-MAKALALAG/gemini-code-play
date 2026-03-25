import { useState, useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { NotebookEditor, type NotebookEditorHandle } from "@/components/NotebookEditor";
import { ChatInterface, ChatInterfaceHandle } from "@/components/ChatInterface";
import { Navbar } from "@/components/Navbar";
import { AuthScreen } from "@/components/AuthScreen";
import { loadSkulpt } from "@/utils/skulptRunner";
import { useToast } from "@/hooks/use-toast";
import { LandingPage } from "@/components/LandingPage";
import { Particles } from "@/components/ui/Particles";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { Code, MessageSquare } from "lucide-react";
import { backendService } from "@/services/backendService";
import { authService } from "@/services/authService";

// ── Mobile tab type (code | chat) ───────────────────────────────────────────
type MobileTab = "code" | "chat";

const Index = () => {
  const location = useLocation();
  const [code, setCode] = useState(`# Selamat datang di AI Coding Assistant!\n# Tulis kode Python kamu di sini dan klik Run per cell\n\nprint("Halo, Dunia! Selamat belajar Python!")\n`);
  const [showStart, setShowStart] = useState(true);
  const [skulptReady, setSkulptReady] = useState(false);
  const { toast } = useToast();
  const chatRef = useRef<ChatInterfaceHandle | null>(null);
  const notebookRef = useRef<NotebookEditorHandle | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [viewMode, setViewMode] = useState<"code" | "chat" | "both">("both");

  // ── Mobile detection & default tab ─────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (location.state?.showLanding) {
      setShowStart(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    loadSkulpt()
      .then(() => setSkulptReady(true))
      .catch((error) => {
        console.error("Failed to load Skulpt:", error);
        toast({ title: "Python Runtime Error", description: "Gagal load Python runtime. Coba refresh halaman.", variant: "destructive" });
        setSkulptReady(false);
      });
  }, [toast]);

  const handleSendToChat = (message: string) => {
    chatRef.current?.sendMessage(message);
    if (isMobile) {
      setMobileTab("chat");
    } else if (viewMode === "code") {
      setViewMode("both");
    }
  };

  // ── Save code to DB ─────────────────────────────────────────────────────
  const handleSaveCode = async (codeToSave: string): Promise<{ success: boolean }> => {
    const user = authService.getUser();
    if (!user) {
      toast({
        title: "Belum login",
        description: "Login dulu untuk menyimpan kode ke database.",
        variant: "destructive",
      });
      return { success: false };
    }

    // Grab the active conversation ID from ChatInterface if available
    const conversationId = chatRef.current?.getConversationId() ?? undefined;

    const { error } = await backendService.saveCodeSnippet(
      user.id,
      codeToSave,
      "python",
      conversationId,
      `Manual save — ${new Date().toLocaleTimeString()}`
    );

    if (error) {
      toast({
        title: "Gagal menyimpan",
        description: "Coba lagi atau periksa koneksi internet.",
        variant: "destructive",
      });
      return { success: false };
    }

    toast({
      title: "✅ Kode tersimpan!",
      description: conversationId
        ? "Kode berhasil disimpan ke database, terhubung ke chat aktif."
        : "Kode berhasil disimpan ke database.",
      duration: 2500,
    });
    return { success: true };
  };

  // ── Shared nodes for reuse across layouts ─────────────────────────────────
  const editorNode = (
    <NotebookEditor
      ref={notebookRef}
      code={code}
      onChange={setCode}
      onSendToChat={handleSendToChat}
      onSaveCode={handleSaveCode}
      isRuntimeReady={skulptReady}
    />
  );

  const chatNode = (
    <ChatInterface
      ref={chatRef}
      getCurrentCode={() => code}
      getNotebookContext={() => notebookRef.current?.getCells()}
      onLoadCode={(c) => setCode(c)}
      onSignInClick={() => setShowAuth(true)}
    />
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden relative bg-background">
      <Helmet>
        <title>AI Coding Assistant</title>
        <meta name="description" content="UNKLAB AI Code (unklab-aicode) - Interactive Python coding environment with AI chatbot assistance. Write, execute, and improve Python code with instant AI feedback." />
        <meta name="keywords" content="unklab-aicode, unklab ai code, UNKLAB, AI coding assistant, Python IDE, online Python editor, AI programming help, code debugging" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <link rel="canonical" href="https://unklab-aicode.online/" />
      </Helmet>
      <Particles />

      {/* Landing page overlay */}
      {showStart && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <LandingPage onGetStarted={() => setShowStart(false)} />
        </div>
      )}

      {/* Auth modal */}
      {showAuth && !showStart && (
        <AuthScreen onAuthenticated={() => setShowAuth(false)} />
      )}

      {/* Navbar — hide view-mode toggle on mobile (use bottom nav instead) */}
      <Navbar
        viewMode={isMobile ? undefined : viewMode}
        onViewModeChange={isMobile ? undefined : setViewMode}
        onSignInClick={() => setShowAuth(true)}
      />

      {/* ── MOBILE LAYOUT ──────────────────────────────────────────────────── */}
      {isMobile ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-background">
          {/* Single panel — switches by tab */}
          <div className="flex-1 min-h-0 relative">
            <div className="absolute inset-0 overflow-hidden">
              {mobileTab === "code" && (
                <div className="h-full">{editorNode}</div>
              )}
              {mobileTab === "chat" && (
                <div className="h-full">{chatNode}</div>
              )}
            </div>
          </div>

          {/* ── Fixed bottom navigation bar ── */}
          <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-sm safe-area-bottom">
            <div className="flex items-stretch h-12 sm:h-14">
              <button
                onClick={() => setMobileTab("code")}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] sm:text-[10px] font-semibold transition-colors ${
                  mobileTab === "code"
                    ? "text-primary border-t-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Notebook</span>
              </button>
              <button
                onClick={() => setMobileTab("chat")}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] sm:text-[10px] font-semibold transition-colors ${
                  mobileTab === "chat"
                    ? "text-primary border-t-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>AI Chat</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── DESKTOP LAYOUT ───────────────────────────────────────────────── */
        <div className="flex-1 min-h-0 px-3 py-3">
          <div className="h-full">
            {viewMode === "both" ? (
              <PanelGroup direction="horizontal" className="h-full gap-3">
                <Panel defaultSize={58} minSize={30} className="min-w-0">
                  {editorNode}
                </Panel>
                <PanelResizeHandle className="w-1.5 bg-border/50 rounded-full hover:bg-primary/50 transition-colors cursor-col-resize" />
                <Panel minSize={25} defaultSize={42} className="min-w-0">
                  {chatNode}
                </Panel>
              </PanelGroup>
            ) : viewMode === "code" ? (
              <div className="h-full">{editorNode}</div>
            ) : (
              <div className="h-full max-w-5xl mx-auto">
                {chatNode}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
