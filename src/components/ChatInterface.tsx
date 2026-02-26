import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Loader2, Plus, X, PanelLeft, LogIn, MessageSquare, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { backendService } from "@/services/backendService";
import { fetchUserApiKey, streamGeminiResponse, clearCachedApiKey } from "@/services/geminiService";
import { streamGroqFallback } from "@/services/groqFallbackService";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChatSidebar } from "./ChatSidebar";
import { useTypewriter } from "@/hooks/useTypewriter";
import { AIStatusIndicator } from "./AIStatusIndicator";
import { ErrorAlert } from "./ErrorAlert";

// ─── Chat-specific error mapping ─────────────────────────────────────────────
function mapChatError(err: any): { title: string; message: string; status: number | string } {
  const raw: string = err?.message || String(err) || "";
  const lower = raw.toLowerCase();

  // 429 — quota / rate limit
  if (raw.includes("429") || lower.includes("quota") || lower.includes("rate limit") || lower.includes("too many")) {
    return { title: "Kuota AI Habis", message: "Kuota harian AI habis. Silakan coba lagi nanti atau ganti API key.", status: 429 };
  }

  // Network / offline
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("failed to fetch") || lower.includes("networkerror") || !navigator.onLine) {
    return { title: "Koneksi Terputus", message: "Koneksi internet terganggu, gagal mengirim pesan. Periksa koneksimu dan coba lagi.", status: 0 };
  }

  // API key missing/invalid
  if (lower.includes("api key") || lower.includes("api_key") || lower.includes("invalid key") || lower.includes("unauthorized")) {
    return { title: "API Key Tidak Valid", message: "API key tidak valid atau sudah kedaluwarsa. Perbarui di menu Settings.", status: 401 };
  }

  // Server error
  if (raw.includes("500") || raw.includes("503") || lower.includes("server")) {
    return { title: "Server Bermasalah", message: "Server AI sedang bermasalah, silakan coba beberapa saat lagi.", status: 500 };
  }

  return { title: "Gagal Mengirim", message: raw || "Terjadi kesalahan. Silakan coba lagi.", status: "unknown" };
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export type ChatInterfaceHandle = {
  sendMessage: (content: string) => void;
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiStage, setAiStage] = useState<'idle' | 'thinking' | 'verifying' | 'done'>('idle');
  const [noApiKey, setNoApiKey] = useState(false);
  // true while Groq fallback is actively streaming
  const [usingFallback, setUsingFallback] = useState(false);

  // Global chat error state (shown in ErrorAlert)
  const [chatError, setChatError] = useState<{ title: string; message: string } | null>(null);

  // Ref to avoid stale closure in useImperativeHandle
  const isLoadingRef = useRef(false);

  const showChatError = (err: any) => {
    const mapped = mapChatError(err);
    setChatError({ title: mapped.title, message: mapped.message });
    console.error(`[ERROR_LOG] Status: ${mapped.status} | Message: ${err?.message ?? mapped.message}`);
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Scroll to bottom on new messages ──────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const h = Math.max(44, Math.min(textareaRef.current.scrollHeight, 200));
      textareaRef.current.style.height = h + 'px';
    }
  }, [input]);

  // ── Init: load user + conversations ───────────────────────────────────────
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
        const latest = convList[0];
        setCurrentTitle(latest.title || "Untitled");
        setConversationId(latest.id);

        const { data: msgs } = await backendService.getMessages(latest.id);
        if (msgs) setMessages(msgs.map((m) => ({ role: m.role, content: m.content })));

        const { data: snippets } = await backendService.getCodeByConversation(latest.id);
        const code = snippets?.[0]?.code_content ?? latest.last_code ?? null;
        if (code) {
          if (props.onLoadCode) props.onLoadCode(code);
        }
      }
      setLoadingHistory(false);
    };
    init();

    return () => { abortControllerRef.current?.abort(); };
  }, []);

  // ── Core chat function — calls Gemini (with 30s timeout) → Groq fallback ────
  // `allMessages` = the complete conversation to send (including the new user msg)
  const chatOnce = async (allMessages: Message[]) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setNoApiKey(false);
    setUsingFallback(false);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const mainSignal = abortControllerRef.current.signal;

    try {
      const user = authService.getUser();
      if (!user) {
        toast({ title: "Not logged in", description: "Please sign in to chat" });
        return;
      }

      const userId = user.id;
      const accessToken = authService.getAccessToken();

      // ── 1. Get API key (cached after first fetch) ────────────────────────
      let apiKey: string;
      try {
        apiKey = await fetchUserApiKey(userId, accessToken || "");
      } catch (keyErr: any) {
        setNoApiKey(true);
        toast({ title: "API Key Missing", description: keyErr.message, variant: "destructive" });
        return;
      }

      // ── 2. Ensure conversation exists ────────────────────────────────────
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

      // ── 3. Save user message to DB (fire-and-forget) ────────────────────
      const lastUserMsg = allMessages[allMessages.length - 1];
      backendService.addMessage(convId, userId, "user", lastUserMsg.content).catch(console.warn);

      // ── 4. Show thinking indicator ───────────────────────────────────────
      setAiStage('thinking');
      const thinkTimer = setTimeout(() => setAiStage('verifying'), 1200);

      // ── 5. Add streaming placeholder ─────────────────────────────────────
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      // ── 6. Shared streaming state ────────────────────────────────────────
      let isFirstChunk = true;
      let fullText = "";

      // Chunk handler — dipakai oleh Gemini DAN Groq
      const handleChunk = (chunk: string) => {
        if (isFirstChunk) {
          isFirstChunk = false;
          clearTimeout(thinkTimer);
          setAiStage('done');
          setTimeout(() => setAiStage('idle'), 800);
        }
        fullText += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          const idx = updated.length - 1;
          if (updated[idx]?.role === 'assistant') {
            updated[idx] = { role: "assistant", content: fullText };
          }
          return updated;
        });
      };

      // ── 7. Gemini stream + 30-detik timeout ──────────────────────────────
      // AbortController khusus untuk Gemini (agar bisa di-abort tanpa
      // membatalkan seluruh chatOnce — Groq masih bisa berjalan setelahnya)
      const geminiAbort = new AbortController();
      // Kalau user cancel (mainSignal), abort Gemini juga
      mainSignal.addEventListener('abort', () => geminiAbort.abort(), { once: true });

      let timedOut = false;
      let timeoutHandle: ReturnType<typeof setTimeout>;

      // Promise yang reject setelah 30 detik
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          geminiAbort.abort('GEMINI_TIMEOUT'); // stop streaming → hemat token Gemini
          reject(new Error('GEMINI_TIMEOUT'));
        }, 30_000);
      });

      try {
        // Race: siapa yang selesai duluan — Gemini atau timeout?
        await Promise.race([
          streamGeminiResponse(apiKey, allMessages, handleChunk, geminiAbort.signal),
          timeoutPromise,
        ]);
        clearTimeout(timeoutHandle!);

      } catch (geminiErr: any) {
        clearTimeout(timeoutHandle!);

        if (timedOut && !mainSignal.aborted) {
          // ── 8. FALLBACK: Gemini timeout → switch ke Groq ───────────────
          // Reset state streaming agar Groq mulai dari awal (bersih)
          isFirstChunk = true;
          fullText = "";
          setAiStage('thinking');
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { role: 'assistant', content: '' };
            }
            return updated;
          });

          toast({
            title: "⚡ Backup AI Aktif",
            description: "Gemini lambat (>30 detik), beralih ke Kimi K2 (Groq)...",
            duration: 4000,
          });

          setUsingFallback(true);
          try {
            await streamGroqFallback(allMessages, handleChunk, mainSignal);
          } finally {
            setUsingFallback(false);
          }

        } else if (!mainSignal.aborted) {
          // Error Gemini bukan timeout dan bukan user cancel → lempar
          throw geminiErr;
        }
      }

      // Kalau stream sama sekali tidak menghasilkan chunk
      if (isFirstChunk) {
        clearTimeout(thinkTimer);
        setAiStage('idle');
      }

      // ── 9. Simpan balasan AI ke DB (fire-and-forget) ─────────────────────
      if (fullText && convId) {
        backendService.addMessage(convId, userId, "assistant", fullText).catch(console.warn);
      }

    } catch (error: any) {
      setAiStage('idle');
      if (error?.name !== 'AbortError') {
        showChatError(error);
        // Hapus placeholder kosong
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1);
          return prev;
        });
      }
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // ── Send handler ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || isLoadingRef.current) return;
    const content = input.trim();
    setInput("");
    setMessages((prev) => {
      const next = [...prev, { role: "user" as const, content }];
      // Using setTimeout(0) to call chatOnce outside the render cycle
      setTimeout(() => chatOnce(next), 0);
      return next;
    });
  };

  useImperativeHandle(ref, () => ({
    sendMessage: (content: string) => {
      if (isLoadingRef.current) return;
      setMessages((prev) => {
        const next = [...prev, { role: "user" as const, content }];
        setTimeout(() => chatOnce(next), 0);
        return next;
      });
    },
  }));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Conversation switching ─────────────────────────────────────────────────
  const handleSwitchConversation = async (id: string) => {
    const user = authService.getUser();
    if (!user) return;
    const userId = user.id;

    // Auto-save current code
    try {
      if (conversationId && props.getCurrentCode) {
        const code = props.getCurrentCode();
        if (code?.trim()) {
          await backendService.saveCodeSnippet(userId, code, "python", conversationId, `Auto-save ${new Date().toLocaleTimeString()}`);
        }
      }
    } catch (e) { console.warn("Auto-save failed", e); }

    setConversationId(id);
    const c = conversations.find(x => x.id === id);
    if (c) setCurrentTitle(c.title);
    setLoadingHistory(true);

    const { data: msgs } = await backendService.getMessages(id);
    setMessages((msgs || []).map((m) => ({ role: m.role, content: m.content })));

    const { data: snippets } = await backendService.getCodeByConversation(id);
    let restoredCode: string | null = snippets?.[0]?.code_content ?? null;
    if (!restoredCode) {
      const { data: convData } = await backendService.getConversation(id);
      restoredCode = convData?.last_code ?? null;
    }
    if (restoredCode) {
      if (props.onLoadCode) {
        props.onLoadCode(restoredCode);
        toast({ title: "Code Restored", description: `Loaded code for "${c?.title || 'this chat'}"`, duration: 2000 });
      }
    }

    setLoadingHistory(false);
    setShowHistory(false);
  };

  // ── Unauthenticated state ──────────────────────────────────────────────────
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

  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-background/50 backdrop-blur-sm overflow-hidden border border-border/50 shadow-inner rounded-lg">

      {/* Desktop sidebar */}
      <div className={`hidden md:block border-r border-border/50 h-full transition-all duration-300 ${sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'}`}>
        <ChatSidebar
          conversations={conversations} currentId={conversationId}
          onSelect={handleSwitchConversation} onNewChat={() => setShowNewModal(true)}
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

      {/* Mobile drawer */}
      <div className={`md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${showHistory ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowHistory(false)} />
      <div className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] bg-card shadow-2xl transform transition-transform duration-300 ${showHistory ? 'translate-x-0' : '-translate-x-full'}`}>
        <ChatSidebar
          conversations={conversations} currentId={conversationId}
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
          isOpen={true} onClose={() => setShowHistory(false)}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-full min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-background border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setShowHistory(true)}>
              <PanelLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden md:flex h-8 w-8" onClick={() => setSidebarOpen(o => !o)}>
              <PanelLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <img src="/AicodeLogo.png" alt="AI Logo" className="w-5 h-5 dark-invert" />
              <h2 className="text-sm font-semibold text-foreground truncate max-w-[140px] sm:max-w-xs">
                {currentTitle || "AI Assistant"}
              </h2>
            </div>
          </div>
          {/* Sembunyikan tombol New di desktop ketika sidebar terbuka */}
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground transition-all duration-200 ${sidebarOpen ? 'hidden md:hidden' : ''}`}
            onClick={() => setShowNewModal(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </div>

        {/* Global chat error alert */}
        <ErrorAlert
          message={chatError?.message ?? null}
          title={chatError?.title}
          onClose={() => setChatError(null)}
        />

        {/* No API key warning */}
        {noApiKey && (
          <div className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Kamu belum menambahkan <strong>Gemini API Key</strong>. Buka menu profil (pojok kanan atas) → <strong>ADD API KEY</strong>.
            </span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-4 space-y-4">
          {loadingHistory && (
            <div className="flex justify-center py-6 text-muted-foreground text-sm">Loading history...</div>
          )}
          {messages.length === 0 && !loadingHistory ? (
            <div className="h-full flex items-center justify-center text-center text-muted-foreground max-w-md mx-auto">
              <div>
                <img src="/AicodeLogo.png" alt="AI" className="w-10 h-10 mx-auto mb-3 opacity-40 dark-invert" />
                <p className="text-sm">Ask me anything about Python!</p>
                {noApiKey && <p className="text-xs mt-2 text-destructive/80">Missing API key — chat is disabled.</p>}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              // Hide empty streaming placeholder while status indicator shows
              if (isLoading && aiStage !== 'idle' && idx === messages.length - 1 && msg.role === 'assistant' && !msg.content) return null;
              return (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`
                    ${msg.role === "user" ? "max-w-[85%]" : "max-w-[98%] w-full"}
                    rounded-xl px-3.5 py-2.5
                    ${msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground bg-secondary/40 border border-border/40"
                    }
                  `}>
                    <ChatMessageContent role={msg.role} content={msg.content} animate={isLoading && idx === messages.length - 1 && msg.role === "assistant"} />
                  </div>
                </div>
              );
            })
          )}

          <AIStatusIndicator stage={aiStage} />

          {/* Banner: tampil saat Groq backup sedang streaming */}
          {usingFallback && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 rounded-full px-3 py-1 shadow-sm">
                <span>⚡</span>
                <span>AI Sedang Memberikan Jawaban</span>
                <Loader2 className="w-3 h-3 animate-spin ml-0.5" />
              </div>
            </div>
          )}

          {isLoading && aiStage === 'idle' && (
            <div className="flex justify-start">
              <div className="bg-secondary text-secondary-foreground rounded-xl px-4 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="p-3 sm:p-4 shrink-0">
          <div className="relative max-w-3xl mx-auto">
            <div className="bg-secondary/60 backdrop-blur-md rounded-2xl border border-border/50 shadow-md p-2 flex items-end gap-2 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-200">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={noApiKey ? "Add an API key to start chatting..." : "Ask UNKLAB AI..."}
                className="flex-1 min-h-[44px] max-h-[200px] border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-2.5 resize-none text-sm placeholder:text-muted-foreground/60 leading-relaxed"
                disabled={isLoading || noApiKey}
                rows={1}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || noApiKey}
                className={`w-9 h-9 rounded-xl p-0 flex items-center justify-center transition-all duration-200 shrink-0 ${input.trim() && !noApiKey ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground'
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
                    if (code?.trim()) await backendService.saveCodeSnippet(userId, code, "python", conversationId, `Auto-save ${new Date().toLocaleTimeString()}`);
                  }
                } catch (e) { }
                const { data: conv, error } = await backendService.createConversation(userId, newChatTitle || "New Chat");
                if (!error && conv) {
                  setConversationId(conv.id);
                  setCurrentTitle(conv.title || "Untitled");
                  setMessages([]);
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

// ── Message rendering ──────────────────────────────────────────────────────────

function ChatMessageContent({ role, content, animate = false }: { role: "user" | "assistant"; content: string; animate?: boolean }) {
  const displayed = useTypewriter(content, animate);
  if (role === "user") return <div className="text-sm whitespace-pre-wrap break-words">{content}</div>;
  return <MarkdownMessage content={displayed} />;
}

function MarkdownMessage({ content }: { content: string }) {
  const segments: Array<{ type: "code" | "text"; lang?: string; text: string }> = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0, match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) segments.push({ type: "text", text: content.slice(lastIndex, match.index) });
    segments.push({ type: "code", lang: match[1]?.toLowerCase(), text: match[2] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) segments.push({ type: "text", text: content.slice(lastIndex) });
  return <div className="space-y-3">{segments.map((s, i) => s.type === "code" ? <CodeBlock key={i} lang={s.lang} code={s.text} /> : <RichText key={i} text={s.text} />)}</div>;
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const isDark = document.documentElement.classList.contains('dark');
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { }
  };
  return (
    <div className={`relative rounded-lg overflow-hidden border ${isDark ? 'border-zinc-700/60' : 'border-zinc-300'}`}>
      <div className={`flex items-center justify-between px-3 py-1.5 border-b ${isDark ? 'bg-zinc-800/80 border-zinc-700/60' : 'bg-zinc-100 border-zinc-300'}`}>
        <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{lang || "code"}</span>
        <button onClick={handleCopy} className={`text-[10px] transition-colors px-2 py-0.5 rounded font-medium ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-700' : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200'}`}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter language={lang || 'text'} style={isDark ? vscDarkPlus : oneLight} customStyle={{ margin: 0, padding: '0.875rem 1rem', fontSize: '0.8125rem', background: isDark ? 'transparent' : '#f8f8f8' }} wrapLines wrapLongLines>
        {code}
      </SyntaxHighlighter>
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
      blocks.push({ type: "ul", content: items }); continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      blocks.push({ type: "ol", content: items }); continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !/^#{1,6}\s+/.test(lines[i])) { para.push(lines[i]); i++; }
    blocks.push({ type: "p", content: para.join("\n") });
  }
  const renderInline = (s: string) => {
    return s.split(/(`[^`]+`)/g).map((part, idx) => {
      if (part.startsWith("`") && part.endsWith("`")) return <code key={idx} className="bg-muted px-1 py-0.5 rounded text-[0.8em] border border-border font-mono">{part.slice(1, -1)}</code>;
      return part.split(/(\*\*[^*]+\*\*)/g).map((bp, bidx) => {
        if (bp.startsWith("**") && bp.endsWith("**")) return <strong key={bidx}>{bp.slice(2, -2)}</strong>;
        return bp.split(/(\*[^*]+\*)/g).map((ip, iidx) => {
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
        if (b.type === "ul") return <ul key={idx} className="list-disc pl-5 space-y-0.5">{(b.content as string[]).map((it: string, i2: number) => <li key={i2}>{renderInline(it)}</li>)}</ul>;
        if (b.type === "ol") return <ol key={idx} className="list-decimal pl-5 space-y-0.5">{(b.content as string[]).map((it: string, i2: number) => <li key={i2}>{renderInline(it)}</li>)}</ol>;
        return <p key={idx} className="whitespace-pre-wrap">{renderInline(b.content as string)}</p>;
      })}
    </div>
  );
}
