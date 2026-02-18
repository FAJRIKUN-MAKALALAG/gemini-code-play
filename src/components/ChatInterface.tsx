import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Loader2, Plus, History, X, Pencil, Check, Trash2, PanelLeft, LogIn, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { backendService } from "@/services/backendService";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChatSidebar } from "./ChatSidebar";
import { useTypewriter } from "@/hooks/useTypewriter";
import { v4 as uuidv4 } from "uuid";
import { AIStatusIndicator } from "./AIStatusIndicator";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.unklab-aicode.online/api';

interface Message {
  role: "user" | "assistant";
  content: string;
}

export type ChatInterfaceHandle = {
  sendMessage: (content: string) => Promise<void>;
};

type ChatProps = { 
  getCurrentCode?: () => string; 
  onLoadCode?: (code: string) => void;
  onSignInClick?: () => void;
};

export const ChatInterface = forwardRef<ChatInterfaceHandle, ChatProps>((props, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const geminiModel = "gemini-2.5-flash";
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; created_at: string; last_code?: string | null }>>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState("New Chat");
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [renaming, setRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [lastCodePreview, setLastCodePreview] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiStage, setAiStage] = useState<'idle' | 'thinking' | 'verifying' | 'done'>('idle');
  const [modelMode, setModelMode] = useState<'fast' | 'reasoning'>('fast');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const minHeight = 60;
      const maxHeight = 200;
      const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
      textareaRef.current.style.height = newHeight + 'px';
    }
  }, [input]);

  useEffect(() => {
    const init = async () => {
      const user = authService.getUser();
      if (!user) return;
      
      const userId = user.id;
      setCurrentUserId(userId);
      setLoadingHistory(true);
      
      const { data: convList } = await backendService.getConversations(userId, 50);
      setConversations(convList || []);

      if (convList && convList.length > 0) {
        const latestConv = convList[0];
        setCurrentTitle(latestConv.title || "Untitled");
        setConversationId(latestConv.id);
        
        const { data: msgs } = await backendService.getMessages(latestConv.id);
        if (msgs) {
          setMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
        }

        const { data: snippets } = await backendService.getCodeByConversation(latestConv.id);
        let restoredCode = null;
        
        if (snippets && snippets.length > 0) {
          // Index 0 is the newest because backend orders by created_at DESC
          const latestSnippet = snippets[0];
          restoredCode = latestSnippet.code_content;
          console.log(`[Init] Restoring code from snippets[0] for ${latestConv.id}`);
        } else if (latestConv.last_code) {
          // Fallback to old last_code field
          restoredCode = latestConv.last_code;
          console.log(`[Init] Restoring code from last_code fallback for ${latestConv.id}`);
        }

        if (restoredCode) {
          setLastCodePreview(restoredCode);
          if (props.onLoadCode) {
            props.onLoadCode(restoredCode);
          }
        }
      }
      setLoadingHistory(false);
    };
    init();
  }, []);

  const chatOnce = async (userMessage: Message) => {
    // 1. STYRICT REQUEST LOCKING: Source of Truth
    if (isLoading) return;
    setIsLoading(true);

    try {
      const user = authService.getUser();
      if (!user) {
        toast({ title: "Not logged in", description: "Please sign in to chat" });
        setIsLoading(false);
        return;
      }

      const userId = user.id;
      let convId = conversationId;
      if (!convId) {
        const { data: conv, error: convErr } = await backendService.createConversation(userId, "New Chat");
        if (convErr) throw convErr;
        convId = conv!.id;
        setConversationId(convId);
        setCurrentTitle("New Chat");
        // Update list
        const { data: convList } = await backendService.getConversations(userId, 50);
        setConversations(convList || []);
      }

      await backendService.addMessage(convId, userId, "user", userMessage.content);

      // Start Thinking
      setAiStage('thinking');
      
      // Simulate transition to verifying after 1.5s
      setTimeout(() => {
        setAiStage('verifying');
      }, 1500);

      const messageHistory = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMessage.content }
      ];

      const targetUrl = `${API_BASE_URL}/chat`;
      // 3. LOGGING API URL: Debugging target
      console.log('🚀 Target API:', targetUrl);

      const gemResp = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: messageHistory, 
          userId: userId,
          mode: modelMode 
        }),
      });

      // 4. ERROR HANDLING: Capture specific codes
      if (!gemResp.ok) {
        if (gemResp.status === 429) {
          throw new Error("Antrian terlalu padat (429). Mohon tunggu sebentar.");
        }
        if (gemResp.status === 500) {
          throw new Error("Terjadi masalah pada Server backend (500).");
        }
        throw new Error(`Gemini error ${gemResp.status}`);
      }

      // NEW STREAMING LOGIC
      const assistantMessageIndex = messages.length + 1;
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]); 

      const reader = gemResp.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let isFirstChunk = true;
      let buffer = ""; // Buffer for incomplete JSON chunks

      if (!reader) throw new Error("No reader found");

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split("\n");
          // Keep the last partial line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;

              try {
                const data = JSON.parse(jsonStr);
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                
                if (text) {
                  if (isFirstChunk) {
                    isFirstChunk = false;
                    setAiStage('done');
                    setTimeout(() => setAiStage('idle'), 1000);
                  }

                  fullText += text;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[assistantMessageIndex] = { role: "assistant", content: fullText };
                    return newMessages;
                  });
                }
              } catch (e) {
                console.warn("Malformed JSON chunk", line, e);
                // Keep moving, don't crash the stream
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      
      if (fullText) {
        const messageWithMode = `${fullText}---model-mode:${modelMode}---`;
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[assistantMessageIndex] = { role: "assistant", content: messageWithMode };
          return newMessages;
        });
        await backendService.addMessage(convId, userId, "assistant", messageWithMode);
      }
    } catch (error) {
      toast({ title: "Error", description: String(error), variant: "destructive" });
      setAiStage('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    // UI PROTECTION: Check isLoading immediately
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    // chatOnce will set isLoading to true and check it again internally
    await chatOnce(userMessage);
  };

  useImperativeHandle(ref, () => ({
    sendMessage: async (content: string) => {
      if (isLoading) return;
      const userMessage: Message = { role: "user", content };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      await chatOnce(userMessage);
    },
  }));

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSwitchConversation = async (id: string) => {
    const user = authService.getUser();
    if (!user) return;
    const userId = user.id;

    // 1. Save current code to OLD conversation
    try {
      if (conversationId && props.getCurrentCode) {
        const code = props.getCurrentCode();
        if (code && code.trim()) {
           console.log(`[AutoSave] Saving current code to ${conversationId}`);
           await backendService.saveCodeSnippet(userId, code, "python", conversationId, `Auto-save ${new Date().toLocaleTimeString()}`);
        }
      }
    } catch (e) {
      console.warn("Auto-save failed", e);
    }

    // 2. Switch UI
    setConversationId(id);
    const c = conversations.find(x => x.id === id);
    if (c) setCurrentTitle(c.title);
    setLoadingHistory(true);

    // 3. Load messages
    const { data: msgs } = await backendService.getMessages(id);
    setMessages((msgs || []).map((m) => ({ role: m.role, content: m.content })));

    // 4. Restore code from NEW conversation
    const { data: snippets } = await backendService.getCodeByConversation(id);
    let restoredCode = null;
    
    if (snippets && snippets.length > 0) {
      // Index 0 is the newest because backend orders by created_at DESC
      restoredCode = snippets[0].code_content;
      console.log(`[Restoration] Found ${snippets.length} snippets, using snippets[0]`);
    } else {
      console.log(`[Restoration] No snippets found for ${id}, checking fallback...`);
      const { data: convData } = await backendService.getConversation(id);
      if (convData && convData.last_code) {
        restoredCode = convData.last_code;
      }
    }

    if (restoredCode !== null) {
      console.log(`[Restoration] Restoring code for ${id}, length: ${restoredCode.length}`);
      setLastCodePreview(restoredCode);
      if (props.onLoadCode) {
        props.onLoadCode(restoredCode);
        toast({ 
          title: "Code Restored", 
          description: `Loaded code for "${c?.title || 'this chat'}"`,
          duration: 2000 
        });
      }
    } else {
      console.log(`[Restoration] No code history to restore for ${id}`);
      setLastCodePreview(null);
    }

    setLoadingHistory(false);
    setShowHistory(false);
  };

  if (!authService.isAuthenticated()) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 h-full bg-background/50 backdrop-blur-sm">
        <Card className="w-full max-w-sm border-dashed border-2">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>AI Chat Locked</CardTitle>
            <CardDescription>Sign in to save your history and chat with the AI assistant.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button className="w-full" onClick={props.onSignInClick}><LogIn className="w-4 h-4 mr-2" />Sign In</Button>
            <p className="text-[10px] text-center text-muted-foreground uppercase tracking-wider font-semibold">Code execution is available without login</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background/50 backdrop-blur-sm overflow-hidden border border-border/50 shadow-inner group">
      <div className={`hidden md:block border-r border-border/50 h-full transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
         <ChatSidebar
            conversations={conversations}
            currentId={conversationId}
            onSelect={handleSwitchConversation}
            onNewChat={() => setShowNewModal(true)}
            onDelete={async (id) => {
              if (!window.confirm("Delete this conversation?")) return;
              const { error } = await backendService.deleteConversation(id);
              if (!error && currentUserId) {
                const { data: convList } = await backendService.getConversations(currentUserId, 50);
                setConversations(convList || []);
                if (conversationId === id) { setConversationId(null); setCurrentTitle(""); setMessages([]); }
              }
            }}
            isOpen={true}
        />
      </div>
      
      <div className={`md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${showHistory ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowHistory(false)} />
      <div className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-card transform transition-transform duration-300 ${showHistory ? 'translate-x-0' : '-translate-x-full'}`}>
         <ChatSidebar
            conversations={conversations}
            currentId={conversationId}
            onSelect={handleSwitchConversation}
            onNewChat={() => { setShowNewModal(true); setShowHistory(false); }}
            onDelete={async (id) => {
              if (!window.confirm("Delete this conversation?")) return;
              const { error } = await backendService.deleteConversation(id);
              if (!error && currentUserId) {
                const { data: convList } = await backendService.getConversations(currentUserId, 50);
                setConversations(convList || []);
                if (conversationId === id) { setConversationId(null); setCurrentTitle(""); setMessages([]); }
              }
            }}
            isOpen={true}
            onClose={() => setShowHistory(false)}
        />
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0 bg-transparent">
        <div className="relative flex items-center justify-between px-4 py-3 bg-background border-b border-border">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowHistory(true)}><PanelLeft className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" className="hidden md:flex" onClick={() => setSidebarOpen(!sidebarOpen)}><PanelLeft className="w-5 h-5" /></Button>
            <div className="flex items-center gap-2 ml-2">
                 <img src="/AicodeLogo.png" alt="AI Logo" className="w-6 h-6 dark-invert" />
                 <h2 className="text-sm font-semibold text-foreground">AI Assistant</h2>
            </div>
          </div>
          
          <div className="flex flex-1 items-center justify-center gap-2 min-w-0 mx-4 hidden sm:flex">
            <div className="bg-secondary/50 p-1 rounded-full flex items-center gap-1 border border-border/50">
              <button
                onClick={() => setModelMode('fast')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                  modelMode === 'fast' 
                    ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)] scale-105' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>⚡</span> Fast
              </button>
              <button
                onClick={() => setModelMode('reasoning')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                  modelMode === 'reasoning' 
                    ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.4)] scale-105' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>🧠</span> Reasoning
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Automatic restoration enabled, manual button removed per user request */}
          </div>
        </div>
        
        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
          {loadingHistory && <div className="flex justify-center py-6 text-muted-foreground text-sm">Loading history...</div>}
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-muted-foreground max-w-md mx-auto">
              <div>
                <img src="/AicodeLogo.png" alt="AI Agent" className="w-12 h-12 mx-auto mb-3 opacity-50 dark-invert" />
                <p className="text-sm">Ask me anything about Python!</p>
              </div>
            </div>
          ) : (
            messages.map((message, index) => {
               // If we are in "thinking/verifying/done" stage, HIDE the very last message if it is an empty/streaming assistant message
               // to prevent overlap with the indicator.
               if (isLoading && aiStage !== 'idle' && index === messages.length - 1 && message.role === 'assistant') {
                 return null;
               }
               
                const isAssistant = message.role === "assistant";
                const modeMatch = message.content.match(/---model-mode:(fast|reasoning)---$/);
                const msgMode = modeMatch ? modeMatch[1] : null;
                const cleanContent = msgMode ? message.content.replace(/---model-mode:(fast|reasoning)---$/, "") : message.content;

                return (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`
                  ${message.role === "user" ? "max-w-[85%]" : "max-w-[99%]"} 
                  rounded-lg px-4 py-2.5 
                  ${message.role === "user" 
                    ? "bg-primary text-primary-foreground border border-primary" 
                    : "text-foreground bg-secondary/30"
                  }
                  ${isAssistant && msgMode === 'fast' ? "border-l-4 border-blue-500 shadow-[2px_0_10px_-2px_rgba(37,99,235,0.1)]" : ""}
                  ${isAssistant && msgMode === 'reasoning' ? "border-l-4 border-purple-500 shadow-[2px_0_10px_-2px_rgba(147,51,234,0.1)]" : ""}
                `}>
                  <ChatMessageContent role={message.role} content={cleanContent} animate={isLoading && index === messages.length - 1 && message.role === "assistant"} />
                  {isAssistant && msgMode && (
                    <div className={`text-[10px] mt-2 flex items-center gap-1 opacity-60 font-medium ${msgMode === 'fast' ? 'text-blue-500' : 'text-purple-500'}`}>
                      {msgMode === 'fast' ? '⚡ Answered in Fast Mode' : '🧠 Answered in Reasoning Mode'}
                    </div>
                  )}
                </div>
              </div>
            )})
          )}

          
          {/* AI Status Indicator */}
          <AIStatusIndicator stage={aiStage} modelMode={modelMode} />
          
          {isLoading && aiStage === 'idle' && <div className="flex justify-start"><div className="bg-secondary text-secondary-foreground rounded-lg px-4 py-2.5"><Loader2 className="w-4 h-4 animate-spin" /></div></div>}
          <div ref={messagesEndRef} />
        </div>
  
        <div className="p-4 border-t border-border bg-secondary/50">
          <div className="flex gap-2 items-end">
            <Textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={handleKeyPress} placeholder="Ask about Python code..." className="resize-none bg-input border-border" style={{ minHeight: '60px', maxHeight: '200px' }} disabled={isLoading} rows={1} />
            <Button onClick={handleSend} disabled={!input.trim() || isLoading} className="bg-primary hover:shadow-glow"><Send className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
  
      {showNewModal && (
        <div className="absolute inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="bg-white border border-border rounded-lg shadow-card w-full max-w-sm p-4 text-black">
            <div className="text-sm font-semibold mb-2">Create New Chat</div>
            <label className="text-xs text-muted-foreground">Title</label>
            <input className="w-full mt-1 mb-3 px-3 py-2 border border-border rounded outline-none" value={newChatTitle} onChange={(e) => setNewChatTitle(e.target.value)} placeholder={`New Chat ${new Date().toLocaleDateString()}`} autoFocus />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowNewModal(false)}>Cancel</Button>
              <Button size="sm" onClick={async () => {
                const user = authService.getUser();
                if (!user) return;
                const userId = user.id;

                // Save current code to previous conversation
                try {
                  if (conversationId && props.getCurrentCode) {
                    const code = props.getCurrentCode();
                    if (code && code.trim()) {
                      await backendService.saveCodeSnippet(userId, code, "python", conversationId, `Auto-save before new chat ${new Date().toLocaleTimeString()}`);
                    }
                  }
                } catch (e) {}

                const { data: conv, error } = await backendService.createConversation(userId, newChatTitle || "New Chat");
                if (!error && conv) {
                  setConversationId(conv.id);
                  setCurrentTitle(conv.title || "Untitled");
                  setMessages([]);
                  setLastCodePreview(null);
                  const { data: convList } = await backendService.getConversations(userId, 50);
                  setConversations(convList || []);
                }
                setShowNewModal(false);
              }}>Create</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

function ChatMessageContent({ role, content, animate = false }: { role: "user" | "assistant"; content: string; animate?: boolean }) {
  const displayedContent = useTypewriter(content, animate);
  if (role === "user") return <div className="text-sm whitespace-pre-wrap break-words">{content}</div>;
  return <MarkdownMessage content={displayedContent} />;
}

function MarkdownMessage({ content }: { content: string }) {
  const segments: Array<{ type: "code" | "text"; lang?: string; text: string }> = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) segments.push({ type: "text", text: content.slice(lastIndex, match.index) });
    segments.push({ type: "code", lang: match[1]?.toLowerCase(), text: match[2] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) segments.push({ type: "text", text: content.slice(lastIndex) });
  return <div className="space-y-3">{segments.map((seg, i) => seg.type === "code" ? <CodeBlock key={i} lang={seg.lang} code={seg.text} /> : <RichText key={i} text={seg.text} />)}</div>;
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const handleCopy = async () => { try { await navigator.clipboard.writeText(code); } catch {} };
  return (
    <div className="relative">
      <div className="absolute right-2 top-2 text-xs text-muted-foreground">{lang ? lang.toUpperCase() : "CODE"}</div>
      <div className="rounded overflow-hidden border border-zinc-800">
        <SyntaxHighlighter language={lang || 'text'} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem', fontSize: '0.875rem' }} wrapLines={true} wrapLongLines={true}>{code}</SyntaxHighlighter>
      </div>
      <div className="mt-1 flex justify-end"><Button variant="outline" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs">Copy</Button></div>
    </div>
  );
}

function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: Array<{ type: string; content: any }> = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { blocks.push({ type: `h${h[1].length}`, content: h[2] }); i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
      blocks.push({ type: "ul", content: items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      blocks.push({ type: "ol", content: items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !/^#{1,6}\s+/.test(lines[i])) { para.push(lines[i]); i++; }
    blocks.push({ type: "p", content: para.join("\n") });
  }
  const renderInline = (s: string) => {
    const codeSplit = s.split(/(`[^`]+`)/g);
    return codeSplit.map((part, idx) => {
      if (part.startsWith("`") && part.endsWith("`")) return <code key={idx} className="bg-muted px-1 py-0.5 rounded border border-border">{part.slice(1, -1)}</code>;
      const boldSplit = part.split(/(\*\*[^*]+\*\*)/g);
      return boldSplit.map((bp, bidx) => {
        if (bp.startsWith("**") && bp.endsWith("**")) return <strong key={bidx}>{bp.slice(2, -2)}</strong>;
        const italSplit = bp.split(/(\*[^*]+\*)/g);
        return italSplit.map((ip, iidx) => {
          if (ip.startsWith("*") && ip.endsWith("*")) return <em key={iidx}>{ip.slice(1, -1)}</em>;
          return <span key={iidx}>{ip}</span>;
        });
      });
    });
  };
  return (
    <div className="text-sm space-y-2">
      {blocks.map((b, idx) => {
        if (/^h[1-6]$/.test(b.type)) return <div key={idx} className={`font-semibold text-foreground ${b.type === 'h1' ? 'text-xl' : 'text-lg'}`}>{renderInline(b.content)}</div>;
        if (b.type === "ul") return <ul key={idx} className="list-disc pl-5">{(b.content as string[]).map((it, i2) => <li key={i2}>{renderInline(it)}</li>)}</ul>;
        if (b.type === "ol") return <ol key={idx} className="list-decimal pl-5">{(b.content as string[]).map((it, i2) => <li key={i2}>{renderInline(it)}</li>)}</ol>;
        return <p key={idx} className="whitespace-pre-wrap">{renderInline(b.content as string)}</p>;
      })}
    </div>
  );
}
