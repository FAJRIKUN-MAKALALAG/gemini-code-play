import { useState, useEffect } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import { Terminal } from "@/components/Terminal";
import { ChatInterface } from "@/components/ChatInterface";
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
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
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
  }, [toast]);

  const handleRunCode = async () => {
    setOutput([]);
    try {
      const result = await runPythonCode(code);
      setOutput(result);
    } catch (error) {
      setOutput([`Error: ${error}`]);
    }
  };

  const handleClearTerminal = () => {
    setOutput([]);
  };

  const handleSendToChat = () => {
    // This will be handled by the chat interface
    toast({
      title: "Code sent to AI",
      description: "The AI will analyze your code",
    });
  };

  const handleCodeGenerated = (generatedCode: string) => {
    setCode(generatedCode);
    toast({
      title: "Code generated",
      description: "AI-generated code has been added to the editor",
    });
  };

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

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-180px)]">
          {/* Left: Code Editor */}
          <div className="lg:col-span-2 flex flex-col gap-4 h-full">
            <div className="flex-[2] min-h-0">
              <CodeEditor
                code={code}
                onChange={setCode}
                onRun={handleRunCode}
                onClear={handleClearTerminal}
                onSendToChat={handleSendToChat}
              />
            </div>
            
            {/* Terminal */}
            <div className="flex-1 min-h-0">
              <Terminal output={output} />
            </div>
          </div>

          {/* Right: AI Chat */}
          <div className="h-full">
            <ChatInterface onCodeGenerated={handleCodeGenerated} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
