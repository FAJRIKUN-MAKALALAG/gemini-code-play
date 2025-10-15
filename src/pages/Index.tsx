import { useState, useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { CodeEditor } from "@/components/CodeEditor";
import { Terminal } from "@/components/Terminal";
import { ChatInterface, ChatInterfaceHandle } from "@/components/ChatInterface";
import { AuthPanel } from "@/components/AuthPanel";
import { AuthScreen } from "@/components/AuthScreen";
import { supabase } from "@/integrations/supabase/client";
import { loadSkulpt, runPythonCode } from "@/utils/skulptRunner";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Code2 } from "lucide-react";

const Index = () => {
  const [code, setCode] = useState(`# Welcome to AI Python Coding Assistant!
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) setShowAuth(true);
    };
    bootstrapAuth();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
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
    <div className="min-h-screen bg-background p-4">
      {showStart && (
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
          <div
            className={`flex flex-col items-center transition-opacity duration-700 ease-out ${
              startVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            <img
              src="/AicodeLogo.png"
              alt="AIcode Logo"
              className="w-36 h-36 mb-6 select-none"
              draggable={false}
            />
            <button
              onClick={() => setShowStart(false)}
              className="px-6 py-2 rounded-md bg-black text-white font-medium shadow hover:opacity-90 active:opacity-80 transition"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
      {showAuth && !showStart && (
        <AuthScreen onAuthenticated={() => setShowAuth(false)} />
      )}
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-ai rounded-lg shadow-glow">
              <Code2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                AI Python Coding Assistant
              </h1>
              <p className="text-sm text-muted-foreground">
                Write, run, and improve Python code with AI assistance
              </p>
            </div>
          </div>
        </header>

        {/* Main Layout with resizable panels */}
        <div className="h-[calc(100vh-180px)]">
          <PanelGroup direction="horizontal" className="gap-4 h-full">
            <Panel defaultSize={66} minSize={40} className="flex flex-col gap-4 min-w-0">
              <PanelGroup direction="vertical" className="gap-4 flex-1 min-h-0">
                <Panel defaultSize={60} minSize={30} className="min-h-0">
                  <CodeEditor
                    code={code}
                    onChange={setCode}
                    onRun={handleRunCode}
                    onClear={handleClearTerminal}
                    onSendToChat={handleSendToChat}
                  />
                </Panel>
                <PanelResizeHandle className="h-1 bg-border rounded hover:bg-primary transition cursor-row-resize" />
                <Panel minSize={20} className="min-h-0">
                  <Terminal
                    output={output}
                    prompt={prompt}
                    disabled={!prompt || !isRunning}
                    onSubmitInput={(val: string) => inputResolverRef.current?.(val)}
                  />
                </Panel>
              </PanelGroup>
            </Panel>
            <PanelResizeHandle className="w-1 bg-border rounded hover:bg-primary transition cursor-col-resize" />
            <Panel minSize={20} defaultSize={34} className="min-w-0">
              <div className="h-full min-h-0 flex flex-col gap-3">
                <AuthPanel />
                <div className="flex-1 min-h-0">
                  <ChatInterface ref={chatRef} getCurrentCode={() => code} onLoadCode={(c) => setCode(c)} />
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </div>
  );
};

export default Index;
