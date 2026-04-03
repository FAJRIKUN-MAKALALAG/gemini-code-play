import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Loader2, Plus, X, PanelLeft, LogIn, MessageSquare, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { useAuth } from "@/context/AuthContext";
import { backendService } from "@/services/backendService";
import { fetchUserApiKey, streamGeminiResponse, clearCachedApiKey } from "@/services/geminiService";
import { ChatSidebar } from "./ChatSidebar";
import { AIStatusIndicator } from "./AIStatusIndicator";
import { ErrorAlert } from "./ErrorAlert";
import { ChatMessageBubble } from "./chat/ChatMessageBubble";
import { buildContext, type CellSnapshot } from "@/utils/notebookContext";
import { ChatInputForm } from "./chat/ChatInputForm";

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
  /** Token usage info — hanya ada di pesan assistant dari Gemini */
  inputTokens?: number;
  outputTokens?: number;
  /** Aktifkan typewriter animation saat pesan pertama kali ditambahkan */
  animateOnAdd?: boolean;
}

export type ChatInterfaceHandle = {
  sendMessage: (content: string) => void;
  /** Tampilkan pesan langsung sebagai balasan AI — dengan typewriter animation & token info */
  displayAssistantMessage: (content: string, usage?: { inputTokens: number; outputTokens: number }) => void;
  getConversationId: () => string | null;
  /** Membuat chat baru (jika belum ada) dan update state chatnya, mereturn conversationId */
  getOrCreateConversationId: (title: string) => Promise<string | null>;
  getCurrentUserId: () => string | null;
};

type ChatProps = {
  getCurrentCode?: () => string;
  getNotebookContext?: () => CellSnapshot[] | undefined;
  onLoadCode?: (code: string) => void;
  onSignInClick?: () => void;
  isChallengeActive?: boolean;
  onRemoveChallenge?: () => void;
};

export const ChatInterface = forwardRef<ChatInterfaceHandle, ChatProps>((props, ref) => {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  // Global chat error state (shown in ErrorAlert)
  const [chatError, setChatError] = useState<{ title: string; message: string } | null>(null);

  // Hint terakhir dari cek jawaban (ditampilkan di lock screen saat challenge aktif)
  const [lastChallengeHint, setLastChallengeHint] = useState<string | null>(null);

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

  // ── Init: load user + conversations ───────────────────────────────────────
  // Wait until AuthContext has finished checking the cookie session (isLoading=false)
  // before attempting to fetch data. This prevents the /conversations/undefined bug.
  useEffect(() => {
    if (authLoading) return; // Wait for auth check to complete first

    const init = async () => {
      const user = authUser; // Use user from AuthContext (already hydrated)
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
  }, [authLoading, authUser]);

  // ── Reset hint saat tantangan selesai ─────────────────────────────────────
  useEffect(() => {
    if (!props.isChallengeActive) {
      setLastChallengeHint(null);
    }
  }, [props.isChallengeActive]);

  // ── Sliding Window — batasi history yang dikirim ke AI ─────────────────────
  // History lengkap tetap tampil di UI & tersimpan di DB.
  // Hanya N pesan terakhir yang dikirim ke Gemini/Groq agar hemat token.
  const CHAT_WINDOW_SIZE = 10; // 5 pasang tanya-jawab

  // ── Core chat function — calls Gemini (with 30s timeout) ────────────────────
  // `allMessages` = the complete conversation to send (including the new user msg)
  const chatOnce = async (allMessages: Message[]) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setNoApiKey(false);

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

      // ── 1. Get API key (cached after first fetch) ────────────────────────
      let apiKey: string;
      try {
        apiKey = await fetchUserApiKey(userId); // cookie handles auth
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
      let msgInputTokens = 0;
      let msgOutputTokens = 0;

      // Chunk handler — dipakai saat Gemini streaming
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

      // ── 7. HYBRID MEMORY: Sliding Window (sesi ini) + RAG (sesi lama) ──
      // - Sliding window: ambil 10 pesan terakhir untuk konteks percakapan saat ini
      // - RAG context: cari memori relevan dari histori lama via vector search
      // Kombinasi ini hemat token tapi AI tetap "ingat" jangka panjang.
      const WINDOW_SIZE = 10;
      const contextRes = await backendService.getChatContext(lastUserMsg.content);
      const memoryContext = contextRes.data?.context || "";

      const windowedMessages = allMessages.length > WINDOW_SIZE
        ? allMessages.slice(-WINDOW_SIZE)
        : [...allMessages];

      // ── 7.5. Inject Notebook Context ─────────────────────────────────────────
      // Inject context HANYA pada pesan terakhir yang akan dikirim ke API
      // (UI/State 'allMessages' tidak terpengaruh, jadi chat UI tetap bersih)
      if (props.getNotebookContext) {
        const cells = props.getNotebookContext();
        if (cells) {
          const lastMsg = windowedMessages[windowedMessages.length - 1];
          const injectedContext = buildContext(lastMsg.content, cells);
          if (injectedContext) {
            windowedMessages[windowedMessages.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + injectedContext,
            };
          }
        }
      }

      // ── 8. Gemini stream + 30-detik timeout ──────────────────────────────────
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
        const geminiResult = await Promise.race([
          streamGeminiResponse(apiKey, windowedMessages, handleChunk, geminiAbort.signal, memoryContext),
          timeoutPromise,
        ]);
        clearTimeout(timeoutHandle!);
        // Tangkap token usage dari Gemini
        msgInputTokens = geminiResult.usage.inputTokens;
        msgOutputTokens = geminiResult.usage.outputTokens;

      } catch (geminiErr: any) {
        clearTimeout(timeoutHandle!);
        // Lempar error ke handler utama (tampilkan pesan error ke user)
        if (!mainSignal.aborted) {
          throw geminiErr;
        }
      }

      // Kalau stream sama sekali tidak menghasilkan chunk
      if (isFirstChunk) {
        clearTimeout(thinkTimer);
        setAiStage('idle');
      }

      // ── 9. Simpan balasan AI ke DB + update pesan dengan token info ────────
      if (fullText && convId) {
        backendService.addMessage(convId, userId, "assistant", fullText).catch(console.warn);
      }
      // Update pesan terakhir (assistant) dengan token usage
      if (msgInputTokens > 0 || msgOutputTokens > 0) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              inputTokens: msgInputTokens,
              outputTokens: msgOutputTokens,
            };
          }
          return updated;
        });
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
  const handleSend = async (content: string) => {
    if (!content.trim() || isLoadingRef.current) return;
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
    displayAssistantMessage: (content: string, usage?: { inputTokens: number; outputTokens: number }) => {
      // Tampilkan langsung sebagai pesan AI dengan typewriter animation
      setMessages((prev) => [...prev, {
        role: "assistant" as const,
        content,
        animateOnAdd: true,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
      }]);
      // Jika challenge masih aktif, simpan sebagai hint untuk ditampilkan di lock screen
      setLastChallengeHint(content);
      // Simpan ke DB jika ada conversation aktif
      if (conversationId && currentUserId) {
        backendService.addMessage(conversationId, currentUserId, "assistant", content).catch(console.warn);
      }
    },
    getConversationId: () => conversationId,
    getOrCreateConversationId: async (title: string) => {
      if (conversationId) return conversationId;
      if (!currentUserId) return null;
      try {
        const { data: newConv } = await backendService.createConversation(currentUserId, title);
        if (newConv) {
          setConversationId(newConv.id);
          setCurrentTitle(newConv.title);
          const { data: convList } = await backendService.getConversations(currentUserId, 50);
          setConversations(convList || []);
          return newConv.id;
        }
      } catch (err) {
        console.error("Gagal buat auto-conversation", err);
      }
      return null;
    },
    getCurrentUserId: () => currentUserId,
  }));

  // ── Conversation switching ─────────────────────────────────────────────────
  const handleSwitchConversation = async (id: string) => {
    if (id === conversationId) {
      setShowHistory(false);
      return;
    }

    const user = authService.getUser();
    if (!user) return;
    const userId = user.id;

    // 1. Auto-save current code (FIRE AND FORGET — don't block UI)
    if (conversationId && props.getCurrentCode) {
      const code = props.getCurrentCode();
      if (code?.trim()) {
        backendService.saveCodeSnippet(userId, code, "python", conversationId, `Auto-save ${new Date().toLocaleTimeString()}`).catch(console.warn);
      }
    }

    // 2. Clear UI instantly for snappy feel
    setConversationId(id);
    const c = conversations.find(x => x.id === id);
    if (c) setCurrentTitle(c.title);
    setMessages([]);
    setShowHistory(false);
    setLoadingHistory(true);

    // 3. Fetch all required data CONCURRENTLY (Parallel)
    const [msgsRes, snippetsRes, convRes] = await Promise.all([
      backendService.getMessages(id),
      backendService.getCodeByConversation(id),
      backendService.getConversation(id),
    ]);

    setMessages((msgsRes.data || []).map((m) => ({ role: m.role, content: m.content })));

    let restoredCode: string | null = snippetsRes.data?.[0]?.code_content ?? null;
    if (!restoredCode) restoredCode = convRes.data?.last_code ?? null;

    if (restoredCode && props.onLoadCode) {
      props.onLoadCode(restoredCode);
      toast({ title: "Code Restored", description: `Loaded code for "${c?.title || 'this chat'}"`, duration: 1500 });
    } else if (props.onLoadCode) {
      // Clear code if completely empty
      props.onLoadCode("");
    }

    setLoadingHistory(false);
  };

  // ── Rename conversation ────────────────────────────────────────────────────
  const handleRenameConversation = async (id: string, newTitle: string) => {
    // Optimistic update — update UI immediately
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
    if (conversationId === id) setCurrentTitle(newTitle);

    const { error } = await backendService.updateConversation(id, { title: newTitle });
    if (error) {
      // Revert on failure by re-fetching
      if (currentUserId) {
        const { data: convList } = await backendService.getConversations(currentUserId, 50);
        setConversations(convList || []);
      }
      toast({ title: "Gagal Mengubah Nama", description: "Nama percakapan tidak bisa disimpan. Coba lagi.", variant: "destructive" });
    }
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
          onRename={handleRenameConversation}
          onDelete={async (id) => {
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
          onRename={handleRenameConversation}
          onDelete={async (id) => {
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
        <div className="flex items-center justify-between px-2 py-2 sm:px-3 sm:py-2.5 bg-background border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setShowHistory(true)}>
              <PanelLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden md:flex h-8 w-8" onClick={() => setSidebarOpen(o => !o)}>
              <PanelLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <img src="/AicodeLogo.png" alt="AI Logo" className="w-4 h-4 sm:w-5 sm:h-5 dark-invert" />
              <h2 className="text-xs sm:text-sm font-semibold text-foreground truncate max-w-[140px] sm:max-w-xs">
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
        {noApiKey && !props.isChallengeActive && (
          <div className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Kamu belum menambahkan <strong>Gemini API Key</strong>. Buka menu profil (pojok kanan atas) → <strong>ADD API KEY</strong>.
            </span>
          </div>
        )}

        {/* Challenge Lock Screen */}
        {props.isChallengeActive ? (
          <div className="flex-1 flex flex-col items-center justify-start p-4 sm:p-6 overflow-y-auto gap-4 animate-in fade-in zoom-in-95 duration-500">
            <Card className="w-full max-w-sm border-dashed border-2 border-orange-500/50 bg-orange-500/5 shadow-xl">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <span className="text-3xl">🎯</span>
                </div>
                <CardTitle className="text-xl text-orange-600 dark:text-orange-400 font-bold tracking-tight">Mode Latihan Aktif</CardTitle>
                <CardDescription className="text-sm mt-2 text-muted-foreground leading-relaxed">
                  AI Chat dinonaktifkan sementara. Uji kemampuanmu dan selesaikan tantangan ngoding ini <strong>tanpa bantuan AI</strong>!
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-[10px] sm:text-xs text-orange-600/70 font-medium mb-4">Hapus atau ubah teks "# 🎯 TANTANGAN" di dalam cell untuk mengaktifkan AI kembali.</p>
                {props.onRemoveChallenge && (
                  <Button 
                    variant="outline" 
                    className="w-full border-orange-500/30 hover:bg-orange-500/10 hover:text-orange-600"
                    onClick={props.onRemoveChallenge}
                  >
                    🏳️ Menyerah
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Tampilkan feedback cek jawaban terakhir */}
            {lastChallengeHint && (
              <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-400">
                <div className={`rounded-xl border p-4 text-left shadow-md ${
                  lastChallengeHint.includes("✅ LULUS") || lastChallengeHint.includes("LULUS:")
                    ? "bg-emerald-500/5 border-emerald-500/40"
                    : "bg-secondary/60 border-border/50"
                }`}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-base">🤖</span>
                    <span className="text-xs font-semibold text-foreground/80">Feedback Cek Jawaban</span>
                  </div>
                  <ChatMessageBubble role="assistant" content={lastChallengeHint} animate={false} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-auto p-2 sm:p-4 space-y-3 sm:space-y-4">
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
                <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`
                    ${msg.role === "user" ? "max-w-[85%]" : "max-w-[98%] w-full"}
                    rounded-xl px-2.5 py-1.5 sm:px-3.5 sm:py-2.5
                    ${msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground bg-secondary/40 border border-border/40"
                    }
                  `}>
                    <ChatMessageBubble
                      role={msg.role}
                      content={msg.content}
                      animate={
                        (isLoading && idx === messages.length - 1 && msg.role === "assistant") ||
                        (!!msg.animateOnAdd && idx === messages.length - 1 && msg.role === "assistant")
                      }
                    />
                  </div>
                  {/* Token info — hanya tampil di pesan AI yang punya data token */}
                  {msg.role === "assistant" && msg.inputTokens !== undefined && msg.outputTokens !== undefined && (
                    <div className="flex items-center gap-1 mt-0.5 px-1 text-[10px] text-muted-foreground/50 select-none">
                      <span>⚡</span>
                      <span>{msg.inputTokens.toLocaleString()} in</span>
                      <span>·</span>
                      <span>{msg.outputTokens.toLocaleString()} out</span>
                      <span>·</span>
                      <span>{(msg.inputTokens + msg.outputTokens).toLocaleString()} tok</span>
                    </div>
                  )}
                </div>
              );
            })
          )}

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

        {/* Input bar */}
        <ChatInputForm
          onSend={handleSend}
          onStop={() => {
            abortControllerRef.current?.abort();
            setAiStage('idle');
          }}
          isLoading={isLoading}
          noApiKey={noApiKey}
        />
      </>
      )}
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
                
                // 1. Close modal and show loading immediately
                setShowNewModal(false);
                setLoadingHistory(true);
                
                // 2. Fire and forget auto-save (don't block)
                if (conversationId && props.getCurrentCode) {
                  const code = props.getCurrentCode();
                  if (code?.trim()) {
                    backendService.saveCodeSnippet(userId, code, "python", conversationId, `Auto-save ${new Date().toLocaleTimeString()}`).catch(console.warn);
                  }
                }
                
                // 3. Create conversation in backend
                const { data: conv, error } = await backendService.createConversation(userId, newChatTitle || "New Chat");
                
                if (!error && conv) {
                  setConversationId(conv.id);
                  setCurrentTitle(conv.title || "Untitled");
                  setMessages([]);
                  if (props.onLoadCode) props.onLoadCode(""); // Clear editor instantly
                  
                  // Optimistically add to sidebar immediately before fetching
                  setConversations(prev => [{ id: conv.id, title: conv.title, created_at: new Date().toISOString() }, ...prev]);
                  
                  // Refetch list in background to sync exactly
                  backendService.getConversations(userId, 50).then(res => {
                    if (res.data) setConversations(res.data);
                  });
                }
                
                setLoadingHistory(false);
                setNewChatTitle(""); // reset input for next time
              }}>Create</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

