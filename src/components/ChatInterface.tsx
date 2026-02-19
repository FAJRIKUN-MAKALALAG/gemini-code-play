import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Loader2, Plus, X, PanelLeft, LogIn, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { backendService } from "@/services/backendService";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChatSidebar } from "./ChatSidebar";
import { useTypewriter } from "@/hooks/useTypewriter";
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
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; created_at: string; last_code?: string | null }>>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState("New Chat");
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [lastCodePreview, setLastCodePreview] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiStage, setAiStage] = useState<'idle' | 'thinking' | 'verifying' | 'done'>('idle');

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
      const minHeight = 44;
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
          const latestSnippet = snippets[0];
          restoredCode = latestSnippet.code_content;
        } else if (latestConv.last_code) {
          restoredCode = latestConv.last_code;
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

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const chatOnce = async (userMessage: Message) => {
    if (isLoading) return;
    setIsLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

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
        const { data: convList } = await backendService.getConversations(userId, 50);
        setConversations(convList || []);
      }

      await backendService.addMessage(convId, userId, "user", userMessage.content);
      setAiStage('thinking');
      
      setTimeout(() => {
        setAiStage('verifying');
      }, 1500);

      const messageHistory = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMessage.content }
      ];

      const targetUrl = `${API_BASE_URL}/chat`;

      const gemResp = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: messageHistory, 
          userId: userId,
        }),
        signal: abortControllerRef.current.signal
      });

      if (!gemResp.ok) {
        let msg = `Gemini error ${gemResp.status}`;
        if (gemResp.status === 401) {
          msg = "Sesi Anda telah berakhir. Silakan login kembali.";
          authService.logout();
        } else if (gemResp.status === 429) {
          msg = "Antrian terlalu padat (429). Mohon tunggu sebentar.";
        } else if (gemResp.status === 500) {
          msg = "Terjadi masalah pada Server backend (500).";
        } else {
          try {
            const errData = await gemResp.json();
            msg = errData.error || msg;
          } catch (e) { /* fallback to default */ }
        }
        throw new Error(msg);
      }

      const assistantMessageIndex = messages.length + 1;
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]); 

      const reader = gemResp.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let isFirstChunk = true;
      let buffer = "";

      if (!reader) throw new Error("No reader found");

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;
            
            const jsonStr = trimmedLine.slice(6).trim();
            if (jsonStr === "[DONE]") continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.error) throw new Error(String(data.error));

              const text = data.text || data.candidates?.[0]?.content?.parts?.[0]?.text;
              
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
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      
      if (fullText) {
        await backendService.addMessage(convId, userId, "assistant", fullText);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted');
      } else {
        toast({ title: "Error", description: error.message || String(error), variant: "destructive" });
      }
      setAiStage('idle');
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
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

    try {
      if (conversationId && props.getCurrentCode) {
        const code = props.getCurrentCode();
        if (code && code.trim()) {
           await backendService.saveCodeSnippet(userId, code, "python", conversationId, `Auto-save ${new Date().toLocaleTimeString()}`);
        }
      }
    } catch (e) {
      console.warn("Auto-save failed", e);
    }

    setConversationId(id);
    const c = conversations.find(x => x.id === id);
    if (c) setCurrentTitle(c.title);
    setLoadingHistory(true);

    const { data: msgs } = await backendService.getMessages(id);
    setMessages((msgs || []).map((m) => ({ role: m.role, content: m.content })));

    const { data: snippets } = await backendService.getCodeByConversation(id);
    let restoredCode = null;
    
    if (snippets && snippets.length > 0) {
      restoredCode = snippets[0].code_content;
    } else {
      const { data: convData } = await backendService.getConversation(id);
      if (convData && convData.last_code) {
        restoredCode = convData.last_code;
      }
    }

    if (restoredCode !== null) {
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
      setLastCodePreview(null);
    }

    setLoadingHistory(false);
    setShowHistory(false);
  };

  if (!authService.isAuthenticated()) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 h-full">
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
    <div className="flex h-full bg-background/50 backdrop-blur-sm overflow-hidden border border-border/50 shadow-inner rounded-lg">
      {/* Desktop sidebar */}
      <div className={`hidden md:block border-r border-border/50 h-full transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'}`}>
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
      
      {/* Mobile drawer backdrop */}
      <div className={`md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${showHistory ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowHistory(false)} />
      {/* Mobile drawer */}
      <div className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] bg-card shadow-2xl transform transition-transform duration-300 ${showHistory ? 'translate-x-0' : '-translate-x-full'}`}>
         <ChatSidebar
            conversations={conversations}
            currentId={conversationId}
            onSelect={(id) => { handleSwitchConversation(id); setShowHistory(false); }}
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

      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Chat header */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-background border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {/* Mobile drawer toggle */}
            <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setShowHistory(true)}>
              <PanelLeft className="w-4 h-4" />
            </Button>
            {/* Desktop sidebar toggle */}
            <Button variant="ghost" size="icon" className="hidden md:flex h-8 w-8" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <PanelLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <img src="/AicodeLogo.png" alt="AI Logo" className="w-5 h-5 dark-invert" />
              <h2 className="text-sm font-semibold text-foreground truncate">
                {currentTitle || "AI Assistant"}
              </h2>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setShowNewModal(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </div>
        
        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-4 space-y-4">
          {loadingHistory && (
            <div className="flex justify-center py-6 text-muted-foreground text-sm">
              Loading history...
            </div>
          )}
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-muted-foreground max-w-md mx-auto">
              <div>
                <img src="/AicodeLogo.png" alt="AI Agent" className="w-10 h-10 mx-auto mb-3 opacity-40 dark-invert" />
                <p className="text-sm">Ask me anything about Python!</p>
              </div>
            </div>
          ) : (
            messages.map((message, index) => {
               if (isLoading && aiStage !== 'idle' && index === messages.length - 1 && message.role === 'assistant') {
                 return null;
               }
                return (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`
                  ${message.role === "user" ? "max-w-[85%]" : "max-w-[98%] w-full"} 
                  rounded-xl px-3.5 py-2.5 
                  ${message.role === "user" 
                    ? "bg-primary text-primary-foreground" 
                    : "text-foreground bg-secondary/40 border border-border/40"
                  }
                `}>
                  <ChatMessageContent role={message.role} content={message.content} animate={isLoading && index === messages.length - 1 && message.role === "assistant"} />
                </div>
              </div>
            )})
          )}

          {/* AI Status Indicator */}
          <AIStatusIndicator stage={aiStage} />
          
          {isLoading && aiStage === 'idle' && (
            <div className="flex justify-start">
              <div className="bg-secondary text-secondary-foreground rounded-xl px-4 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
  
        {/* Input area */}
        <div className="p-3 sm:p-4 bg-transparent shrink-0">
          <div className="relative max-w-3xl mx-auto">
            <div className="bg-secondary/60 backdrop-blur-md rounded-2xl border border-border/50 shadow-md p-2 flex items-end gap-2 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-200">
              <Textarea 
                ref={textareaRef} 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={handleKeyPress} 
                placeholder="Ask UNKLAB AI..." 
                className="flex-1 min-h-[44px] max-h-[200px] border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-2.5 resize-none text-sm placeholder:text-muted-foreground/60 leading-relaxed" 
                disabled={isLoading} 
                rows={1} 
              />
              
              <Button 
                onClick={handleSend} 
                disabled={!input.trim() || isLoading} 
                className={`w-9 h-9 rounded-xl p-0 flex items-center justify-center transition-all duration-200 shrink-0 ${
                  input.trim() ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground'
                }`}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-center text-muted-foreground/40 mt-1.5 px-2 italic">
              AI can make mistakes. Always verify important information.
            </p>
          </div>
        </div>
      </div>
  
      {/* New Chat Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowNewModal(false)}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">New Conversation</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowNewModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <label className="text-xs text-muted-foreground font-medium">Title</label>
            <input
              className="w-full mt-1.5 mb-4 px-3 py-2 bg-background border border-border rounded-lg outline-none text-sm focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground transition-all"
              value={newChatTitle}
              onChange={(e) => setNewChatTitle(e.target.value)}
              placeholder={`Chat ${new Date().toLocaleDateString()}`}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.form?.requestSubmit()}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowNewModal(false)}>Cancel</Button>
              <Button size="sm" onClick={async () => {
                const user = authService.getUser();
                if (!user) return;
                const userId = user.id;

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
    <div className="relative rounded-lg overflow-hidden border border-zinc-700/60">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/80 border-b border-zinc-700/60">
        <span className="text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="text-[10px] text-zinc-400 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-zinc-700 font-medium"
        >
          Copy
        </button>
      </div>
      <SyntaxHighlighter language={lang || 'text'} style={vscDarkPlus} customStyle={{ margin: 0, padding: '0.875rem 1rem', fontSize: '0.8125rem', background: 'transparent' }} wrapLines={true} wrapLongLines={true}>{code}</SyntaxHighlighter>
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
      if (part.startsWith("`") && part.endsWith("`")) return <code key={idx} className="bg-muted px-1 py-0.5 rounded text-[0.8em] border border-border font-mono">{part.slice(1, -1)}</code>;
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
    <div className="text-sm space-y-2 leading-relaxed">
      {blocks.map((b, idx) => {
        if (/^h[1-6]$/.test(b.type)) return <div key={idx} className={`font-bold text-foreground ${b.type === 'h1' ? 'text-lg' : b.type === 'h2' ? 'text-base' : 'text-sm'} mt-1`}>{renderInline(b.content)}</div>;
        if (b.type === "ul") return <ul key={idx} className="list-disc pl-5 space-y-0.5">{(b.content as string[]).map((it, i2) => <li key={i2}>{renderInline(it)}</li>)}</ul>;
        if (b.type === "ol") return <ol key={idx} className="list-decimal pl-5 space-y-0.5">{(b.content as string[]).map((it, i2) => <li key={i2}>{renderInline(it)}</li>)}</ol>;
        return <p key={idx} className="whitespace-pre-wrap">{renderInline(b.content as string)}</p>;
      })}
    </div>
  );
}
