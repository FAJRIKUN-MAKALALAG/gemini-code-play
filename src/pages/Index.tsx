import { useState, useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { CodeEditor } from "@/components/CodeEditor";
import { Terminal } from "@/components/Terminal";
import { ChatInterface, ChatInterfaceHandle } from "@/components/ChatInterface";
import { Navbar } from "@/components/Navbar";
import { AuthScreen } from "@/components/AuthScreen";
import { authService } from "@/services/authService";
import { loadSkulpt, runPythonCode } from "@/utils/skulptRunner";
import { useToast } from "@/hooks/use-toast";
import { LandingPage } from "@/components/LandingPage";
import { Particles } from "@/components/ui/Particles";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { Code, MessageSquare, SquareTerminal } from "lucide-react";

// ── Mobile tab type (code | terminal | chat) ────────────────────────────────
type MobileTab = "code" | "terminal" | "chat";

const Index = () => {
  const location = useLocation();
  const [code, setCode] = useState(`# Selamat datang di AI Coding Assistant!
# Tulis kode Python kamu di sini dan klik Run

nama = input("Masukkan nama kamu: ")
print(f"Halo, {nama}! Selamat belajar Python!")
`);
  const [output, setOutput] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);
  const inputResolverRef = useRef<((value: string) => void) | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showStart, setShowStart] = useState(true);
  const [skulptReady, setSkulptReady] = useState(false);
  const { toast } = useToast();
  const chatRef = useRef<ChatInterfaceHandle | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [viewMode, setViewMode] = useState<"code" | "chat" | "both">("both");
  const [showTerminal, setShowTerminal] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

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

  const handleRunCode = async () => {
    setOutput([]);
    setPrompt(null);
    setIsRunning(true);
    setLastError(null);
    // Auto-switch to terminal tab on mobile when running
    if (isMobile) setMobileTab("terminal");
    try {
      const appendChunk = (chunk: string) => {
        const normalized = chunk.replace(/\r/g, "");
        const parts = normalized.split("\n");
        setOutput((prev) => {
          const out = [...prev];
          if (out.length === 0) out.push("");
          out[out.length - 1] = (out[out.length - 1] || "") + parts[0];
          for (let i = 1; i < parts.length; i++) out.push(parts[i]);
          return out;
        });
      };

      await runPythonCode(code, {
        inputProvider: (p?: string) =>
          new Promise<string>((resolve) => {
            setPrompt(p || "");
            inputResolverRef.current = (val: string) => {
              resolve(val);
              inputResolverRef.current = null;
              setPrompt(null);
            };
          }),
        onStdout: appendChunk,
        onStderr: (errChunk: string) => {
          setLastError((prev) => (prev ? prev + "\n" + errChunk : errChunk));
          appendChunk(errChunk);
        },
      });
    } catch (error) {
      const errMsg = `Error: ${error}`;
      setLastError(errMsg);
      setOutput((prev) => [...prev, errMsg]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleClearTerminal = () => setOutput([]);

  const handleSendToChat = () => {
    const content = `Please review the following Python code and suggest improvements.\n\n\`\`\`python\n${code}\n\`\`\``;
    chatRef.current?.sendMessage(content);
    toast({ title: "Code sent", description: "Sent code to AI chat" });
  };

  const handleDebug = (message: string) => {
    chatRef.current?.sendMessage(message);
    if (isMobile) {
      setMobileTab("chat");
    } else if (viewMode === "code") {
      setViewMode("both");
    }
    toast({ title: "🐛 Debugging...", description: "Mengirim error ke AI untuk dianalisis" });
  };

  // ── Shared editor + terminal for reuse across layouts ──────────────────────
  const editorNode = (
    <CodeEditor
      code={code}
      onChange={setCode}
      onRun={handleRunCode}
      onClear={handleClearTerminal}
      showTerminal={showTerminal}
      onToggleTerminal={() => setShowTerminal((prev) => !prev)}
      lastError={lastError}
      onDebug={handleDebug}
      isRuntimeReady={skulptReady}
      isRunning={isRunning}
    />
  );

  const terminalNode = (
    <Terminal
      output={output}
      prompt={prompt}
      disabled={!prompt || !isRunning}
      onSubmitInput={(val: string) => inputResolverRef.current?.(val)}
    />
  );

  const chatNode = (
    <ChatInterface
      ref={chatRef}
      getCurrentCode={() => code}
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
                <div className="h-full p-1.5">{editorNode}</div>
              )}
              {mobileTab === "terminal" && (
                <div className="h-full p-1.5">{terminalNode}</div>
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
                <span>Editor</span>
              </button>
              <button
                onClick={() => setMobileTab("terminal")}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] sm:text-[10px] font-semibold transition-colors relative ${
                  mobileTab === "terminal"
                    ? "text-primary border-t-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <SquareTerminal className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Terminal</span>
                {/* Dot indicator when code is running */}
                {isRunning && (
                  <span className="absolute top-2 right-[calc(50%-14px)] w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                )}
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
        /* ── DESKTOP LAYOUT (unchanged) ───────────────────────────────────── */
        <div className="flex-1 min-h-0 px-4 py-3">
          <div className="h-full">
            {viewMode === "both" ? (
              <PanelGroup direction="horizontal" className="h-full gap-3">
                <Panel defaultSize={58} minSize={30} className="flex flex-col min-w-0">
                  <PanelGroup direction="vertical" className="h-full gap-3">
                    <Panel defaultSize={showTerminal ? 62 : 100} minSize={25} className="min-h-0">
                      {editorNode}
                    </Panel>
                    {showTerminal && (
                      <>
                        <PanelResizeHandle className="h-1.5 bg-border/50 rounded-full hover:bg-primary/50 transition-colors cursor-row-resize" />
                        <Panel minSize={18} className="min-h-0">
                          {terminalNode}
                        </Panel>
                      </>
                    )}
                  </PanelGroup>
                </Panel>
                <PanelResizeHandle className="w-1.5 bg-border/50 rounded-full hover:bg-primary/50 transition-colors cursor-col-resize" />
                <Panel minSize={25} defaultSize={42} className="min-w-0">
                  {chatNode}
                </Panel>
              </PanelGroup>
            ) : viewMode === "code" ? (
              <PanelGroup direction="vertical" className="h-full gap-3">
                <Panel defaultSize={showTerminal ? 65 : 100} minSize={25} className="min-h-0">
                  {editorNode}
                </Panel>
                {showTerminal && (
                  <>
                    <PanelResizeHandle className="h-1.5 bg-border/50 rounded-full hover:bg-primary/50 transition-colors cursor-row-resize" />
                    <Panel minSize={18} className="min-h-0">
                      {terminalNode}
                    </Panel>
                  </>
                )}
              </PanelGroup>
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
