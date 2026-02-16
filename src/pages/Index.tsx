import { useState, useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { CodeEditor } from "@/components/CodeEditor";
import { Terminal } from "@/components/Terminal";
import { ChatInterface, ChatInterfaceHandle } from "@/components/ChatInterface";
import { Navbar } from "@/components/Navbar";
import { AuthScreen } from "@/components/AuthScreen";
import { mockAuth } from "@/services/mockAuthService";
import { loadSkulpt, runPythonCode } from "@/utils/skulptRunner";
import { useToast } from "@/hooks/use-toast";
import { LandingPage } from "@/components/LandingPage";
import { Loader2 } from "lucide-react";

import { Particles } from "@/components/ui/Particles";

const Index = () => {
  const [code, setCode] = useState(`# Welcome to AI Python Coding Assistant! GROUPFOX
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
  const [startVisible, setStartVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const chatRef = useRef<ChatInterfaceHandle | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const [viewMode, setViewMode] = useState<"code" | "chat" | "both">("both");
  const [showTerminal, setShowTerminal] = useState(true);

  useEffect(() => {
    // Trigger fade-in for start screen
    setStartVisible(true);

    loadSkulpt()
      .then(() => {
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load Skulpt:", error);
        toast({
          title: "Error",
          description: "Failed to load Python runtime",
          variant: "destructive",
        });
        setIsLoading(false);
      });
    // When start screen dismissed and not logged in, show auth screen
    const bootstrapAuth = async () => {
      const { data: { session } } = await mockAuth.getSessionAsync();
      if (!session) setShowAuth(true);
    };
    bootstrapAuth();
    const { data: sub } = mockAuth.onAuthStateChange((_evt, session) => {
      setShowAuth(!session);
    });
    return () => sub.subscription.unsubscribe();
  }, [toast]);

  const handleRunCode = async () => {
    setOutput([]);
    setPrompt(null);
    setIsRunning(true);
    try {
      const appendChunk = (chunk: string) => {
        const normalized = chunk.replace(/\r/g, "");
        const parts = normalized.split("\n");
        setOutput((prev) => {
          const out = [...prev];
          if (out.length === 0) out.push("");
          // append first part to current line
          out[out.length - 1] = (out[out.length - 1] || "") + parts[0];
          // push remaining parts as new lines
          for (let i = 1; i < parts.length; i++) {
            out.push(parts[i]);
          }
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
        onStderr: appendChunk,
      });
    } catch (error) {
      setOutput((prev) => [...prev, `Error: ${error}`]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleClearTerminal = () => {
    setOutput([]);
  };

  const handleSendToChat = () => {
    const content = `Please review the following Python code and suggest improvements.\n\n\
\u0060\u0060\u0060python\n${code}\n\u0060\u0060\u0060`;
    chatRef.current?.sendMessage(content);
    toast({ title: "Code sent", description: "Sent code to AI chat" });
    setViewMode("chat"); // Switch to chat view if not already
  };

  // Removed auto-insert of AI code into editor; code is copyable from chat.

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading Python runtime...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      <Particles />
      <Navbar viewMode={viewMode} onViewModeChange={setViewMode} />
      {showStart ? (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <LandingPage onGetStarted={() => setShowStart(false)} />
        </div>
      ) : null}
      {showAuth && !showStart && (
        <AuthScreen onAuthenticated={() => setShowAuth(false)} />
      )}
      
      {/* Navbar */}
      <Navbar viewMode={viewMode} onViewModeChange={setViewMode} />
      
      <div className="w-full px-4 py-4">
        {/* Main Layout with resizable panels */}
        <div className="h-[calc(100vh-100px)]">
            {viewMode === "both" ? (
                <PanelGroup direction="horizontal" className="gap-4 h-full">
                    <Panel defaultSize={66} minSize={40} className="flex flex-col gap-4 min-w-0">
                    <PanelGroup direction="vertical" className="gap-4 flex-1 min-h-0">
                        <Panel defaultSize={showTerminal ? 60 : 100} minSize={30} className="min-h-0">
                        <CodeEditor
                            code={code}
                            onChange={setCode}
                            onRun={handleRunCode}
                            onClear={handleClearTerminal}
                            onSendToChat={handleSendToChat}
                            showTerminal={showTerminal}
                            onToggleTerminal={() => setShowTerminal(prev => !prev)}
                        />
                        </Panel>
                        {showTerminal && (
                            <>
                                <PanelResizeHandle className="h-1 bg-border rounded hover:bg-primary transition cursor-row-resize" />
                                <Panel minSize={20} className="min-h-0">
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
                    <PanelResizeHandle className="w-1 bg-border rounded hover:bg-primary transition cursor-col-resize" />
                    <Panel minSize={20} defaultSize={34} className="min-w-0">
                    <ChatInterface ref={chatRef} getCurrentCode={() => code} onLoadCode={(c) => setCode(c)} />
                    </Panel>
                </PanelGroup>
            ) : viewMode === "code" ? (
                <PanelGroup direction="vertical" className="gap-4 h-full">
                    <Panel defaultSize={showTerminal ? 70 : 100} minSize={30} className="min-h-0">
                        <CodeEditor
                            code={code}
                            onChange={setCode}
                            onRun={handleRunCode}
                            onClear={handleClearTerminal}
                            onSendToChat={handleSendToChat}
                            showTerminal={showTerminal}
                            onToggleTerminal={() => setShowTerminal(prev => !prev)}
                        />
                    </Panel>
                    {showTerminal && (
                        <>
                            <PanelResizeHandle className="h-1 bg-border rounded hover:bg-primary transition cursor-row-resize" />
                            <Panel minSize={20} className="min-h-0">
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
                <div className="h-full flex justify-center">
                    <div className="w-full max-w-7xl h-full border border-border rounded-lg overflow-hidden shadow-sm">
                         <ChatInterface ref={chatRef} getCurrentCode={() => code} onLoadCode={(c) => setCode(c)} />
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Index;
