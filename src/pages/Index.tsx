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

const Index = () => {
  // Don't block on auth loading — auth state resolves in background
  const location = useLocation();
  const [code, setCode] = useState(`# Welcome to AI Coding Assistant!
# Write your Python code here and click Run

def greet(name):
    return f"Hello, {name}!"

print(greet("World"))
`);
  const [output, setOutput] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);
  const inputResolverRef = useRef<((value: string) => void) | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showStart, setShowStart] = useState(true);
  // Skulpt loads in background — only disables Run button until ready
  const [skulptReady, setSkulptReady] = useState(false);
  const { toast } = useToast();
  const chatRef = useRef<ChatInterfaceHandle | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [viewMode, setViewMode] = useState<"code" | "chat" | "both">("both");
  const [showTerminal, setShowTerminal] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.showLanding) {
      setShowStart(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    // Load Skulpt non-blocking — UI renders immediately
    loadSkulpt()
      .then(() => setSkulptReady(true))
      .catch((error) => {
        console.error("Failed to load Skulpt:", error);
        toast({ title: "Python Runtime Error", description: "Gagal load Python runtime. Coba refresh halaman.", variant: "destructive" });
        setSkulptReady(false); // still allow render, Run just won't work
      });
  }, [toast]);

  const handleRunCode = async () => {
    setOutput([]);
    setPrompt(null);
    setIsRunning(true);
    setLastError(null);
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
            setPrompt(p || "Input");
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
    if (viewMode === "code") setViewMode("both");
    toast({ title: "🐛 Debugging...", description: "Mengirim error ke AI untuk dianalisis" });
  };


  return (
    <div className="h-screen flex flex-col overflow-hidden relative bg-background">
      <Helmet>
        <title>AI Coding Assistant</title>
        <meta name="description" content="UNKLAB AI Code (unklab-aicode) - Interactive Python coding environment with AI chatbot assistance. Write, execute, and improve Python code with instant AI feedback." />
        <meta name="keywords" content="unklab-aicode, unklab ai code, UNKLAB, AI coding assistant, Python IDE, online Python editor, AI programming help, code debugging" />
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

      {/* Navbar */}
      <Navbar viewMode={viewMode} onViewModeChange={setViewMode} onSignInClick={() => setShowAuth(true)} />

      {/* Main content */}
      <div className="flex-1 min-h-0 px-2 sm:px-4 py-2 sm:py-3">
        <div className="h-full">
          {viewMode === "both" ? (
            /* ─── Split: Code + Chat ─── */
            <PanelGroup direction="horizontal" className="h-full gap-2 sm:gap-3">
              <Panel defaultSize={58} minSize={30} className="flex flex-col min-w-0">
                <PanelGroup direction="vertical" className="h-full gap-2 sm:gap-3">
                  <Panel defaultSize={showTerminal ? 62 : 100} minSize={25} className="min-h-0">
                    <CodeEditor
                      code={code}
                      onChange={setCode}
                      onRun={handleRunCode}
                      onClear={handleClearTerminal}
                      showTerminal={showTerminal}
                      onToggleTerminal={() => setShowTerminal(prev => !prev)}
                      lastError={lastError}
                      onDebug={handleDebug}
                      isRuntimeReady={skulptReady}
                    />
                  </Panel>
                  {showTerminal && (
                    <>
                      <PanelResizeHandle className="h-1.5 bg-border/50 rounded-full hover:bg-primary/50 transition-colors cursor-row-resize" />
                      <Panel minSize={18} className="min-h-0">
                        <Terminal
                          output={output}
                          prompt={prompt}
                          disabled={!prompt || !isRunning}
                          onSubmitInput={(val: string) => inputResolverRef.current?.(val)}
                        />
                      </Panel>
                    </>
                  )}
                </PanelGroup>
              </Panel>
              <PanelResizeHandle className="w-1.5 bg-border/50 rounded-full hover:bg-primary/50 transition-colors cursor-col-resize" />
              <Panel minSize={25} defaultSize={42} className="min-w-0">
                <ChatInterface ref={chatRef} getCurrentCode={() => code} onLoadCode={(c) => setCode(c)} onSignInClick={() => setShowAuth(true)} />
              </Panel>
            </PanelGroup>
          ) : viewMode === "code" ? (
            /* ─── Code Only ─── */
            <PanelGroup direction="vertical" className="h-full gap-2 sm:gap-3">
              <Panel defaultSize={showTerminal ? 65 : 100} minSize={25} className="min-h-0">
                <CodeEditor
                  code={code}
                  onChange={setCode}
                  onRun={handleRunCode}
                  onClear={handleClearTerminal}
                  showTerminal={showTerminal}
                  onToggleTerminal={() => setShowTerminal(prev => !prev)}
                  lastError={lastError}
                  onDebug={handleDebug}
                />
              </Panel>
              {showTerminal && (
                <>
                  <PanelResizeHandle className="h-1.5 bg-border/50 rounded-full hover:bg-primary/50 transition-colors cursor-row-resize" />
                  <Panel minSize={18} className="min-h-0">
                    <Terminal
                      output={output}
                      prompt={prompt}
                      disabled={!prompt || !isRunning}
                      onSubmitInput={(val: string) => inputResolverRef.current?.(val)}
                    />
                  </Panel>
                </>
              )}
            </PanelGroup>
          ) : (
            /* ─── Chat Only ─── */
            <div className="h-full max-w-5xl mx-auto">
              <ChatInterface ref={chatRef} getCurrentCode={() => code} onLoadCode={(c) => setCode(c)} onSignInClick={() => setShowAuth(true)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
