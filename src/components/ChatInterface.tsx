import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Loader2, Plus, History, X, Pencil, Check, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export type ChatInterfaceHandle = {
  sendMessage: (content: string) => Promise<void>;
};

type ChatProps = { getCurrentCode?: () => string; onLoadCode?: (code: string) => void };

export const ChatInterface = forwardRef<ChatInterfaceHandle, ChatProps>((props, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const geminiModel = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || "gemini-2.5-flash";
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // load latest conversation + messages when signed in
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      setLoadingHistory(true);
      const { data: convs } = await supabase
        .from("conversations")
        .select("id,title,created_at,last_code")
        .order("created_at", { ascending: false })
        .limit(1);
      // Load list of recent conversations for history panel
      const { data: convList } = await supabase
        .from("conversations")
        .select("id,title,created_at,last_code")
        .order("created_at", { ascending: false })
        .limit(50);
      setConversations(convList || []);

      if (convs && convs.length > 0) {
        const cid = convs[0].id as string;
        setCurrentTitle(convs[0].title || "Untitled");
        setLastCodePreview((convs[0] as any).last_code ?? null);
        setConversationId(cid);
        const { data: msgs } = await supabase
          .from("chat_messages")
          .select("role, content, created_at")
          .eq("conversation_id", cid)
          .order("created_at", { ascending: true });
        if (msgs) {
          setMessages(msgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
        }
      } else {
        setMessages([]);
      }
      setLoadingHistory(false);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setConversationId(null);
        setMessages([]);
        setConversations([]);
      } else {
        // user signed in -> reload history
        init();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const chatOnce = async (userMessage: Message) => {
    if (!geminiKey) {
      toast({
        title: "Missing API key",
        description: "Set VITE_GEMINI_API_KEY in .env to call the AI",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    try {
      // ensure session (user must be logged in to save history)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Not logged in", description: "Please sign in to chat" });
        return;
      }

      // ensure conversation exists
      let convId = conversationId;
      if (!convId) {
        const { data: conv, error: convErr } = await supabase
          .from("conversations")
          .insert({ user_id: session?.user?.id, title: "New Chat" })
          .select("id")
          .single();
        if (convErr) throw convErr;
        convId = conv!.id as string;
        setConversationId(convId);
      }

      // insert user message
      await supabase.from("chat_messages").insert({
        conversation_id: convId,
        user_id: session?.user?.id,
        role: "user",
        content: userMessage.content,
      });

      // call Gemini generateContent (non-streaming simple call)
      const contents = [...messages, userMessage].map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const gemResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify({ contents }),
        }
      );
      if (!gemResp.ok) {
        const t = await gemResp.text();
        throw new Error(`Gemini error ${gemResp.status}: ${t}`);
      }
      const gjson = await gemResp.json();
      const candidate = gjson.candidates?.[0];
      const assistantText: string = candidate?.content?.parts
        ?.map((p: any) => p?.text || "")
        .join("") || "";

      // update UI
      setMessages((prev) => [...prev, { role: "assistant", content: assistantText }]);

      // insert assistant message
      await supabase.from("chat_messages").insert({
        conversation_id: convId,
        user_id: session?.user?.id,
        role: "assistant",
        content: assistantText,
      });
    } catch (error) {
      console.error("Chat error:", error);
      toast({ title: "Error", description: String(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

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

  return (
    <div className="flex flex-col h-full bg-card rounded-lg overflow-hidden border border-border shadow-card">
      <div className="relative flex items-center justify-between px-4 py-3 bg-gradient-ai border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
          <h2 className="text-sm font-semibold text-primary-foreground">AI Assistant</h2>
        </div>
        <div className="hidden md:flex items-center gap-2 absolute left-1/2 -translate-x-1/2 max-w-[50%]">
          {!renaming ? (
            <>
              <div className="text-sm font-medium text-primary-foreground truncate">{currentTitle || "No chat selected"}</div>
              {conversationId && (
                <button
                  className="text-primary-foreground/80 hover:text-primary-foreground"
                  onClick={() => {
                    setRenaming(true);
                    setRenameTitle(currentTitle || "");
                  }}
                  title="Rename chat"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <input
                className="text-xs px-2 py-1 rounded bg-white/20 text-primary-foreground placeholder:text-primary-foreground/60 outline-none"
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                autoFocus
              />
              <button
                className="text-primary-foreground hover:opacity-90"
                onClick={async () => {
                  if (!conversationId) return;
                  await supabase
                    .from("conversations")
                    .update({ title: renameTitle || "Untitled" })
                    .eq("id", conversationId);
                  setCurrentTitle(renameTitle || "Untitled");
                  // refresh list
                  const { data: convList } = await supabase
                    .from("conversations")
                    .select("id,title,created_at")
                    .order("created_at", { ascending: false })
                    .limit(50);
                  setConversations(convList || []);
                  setRenaming(false);
                }}
                title="Save title"
              >
                <Check className="w-4 h-4" />
              </button>
              <button className="text-primary-foreground/80 hover:text-primary-foreground" onClick={() => setRenaming(false)} title="Cancel">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-8"
            onClick={() => setShowNewModal(true)}
          >
            <Plus className="w-4 h-4 mr-1" /> New
          </Button>
          <Button size="sm" variant="secondary" className="h-8" onClick={() => setShowHistory((s) => !s)}>
            <History className="w-4 h-4 mr-1" /> History
          </Button>
          {props.onLoadCode && lastCodePreview && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8"
              onClick={() => props.onLoadCode?.(lastCodePreview)}
              title="Load saved code into editor"
            >
              Load Code
            </Button>
          )}
        </div>
      </div>
      
      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
        {loadingHistory && (
          <div className="flex justify-center py-6 text-muted-foreground text-sm">Loading chat history...</div>
        )}
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground max-w-md">
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-primary opacity-50" />
              <p className="text-sm">
                Ask me anything about Python! I can help you write code, debug errors, or explain concepts.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2.5 border ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-gradient-to-r from-accent/10 to-primary/5 text-foreground border-accent/30"
                }`}
              >
                <ChatMessageContent role={message.role} content={message.content} />
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-secondary text-secondary-foreground rounded-lg px-4 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border bg-secondary/50">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about Python code..."
            className="min-h-[60px] max-h-[120px] resize-none bg-input border-border"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-primary hover:bg-primary/90 hover:shadow-glow transition-all self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* History Drawer */}
      {showHistory && (
        <div className="absolute inset-0 bg-black/10">
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85%] bg-white border-l border-border shadow-card p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Chat History</div>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setShowHistory(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-muted-foreground mb-2">Click to open a conversation</div>
            <div className="flex-1 overflow-auto space-y-2">
              {conversations.length === 0 && (
                <div className="text-sm text-muted-foreground">No conversations yet</div>
              )}
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={`w-full text-left border rounded p-2 hover:bg-muted ${
                    c.id === conversationId ? "bg-primary/10 border-primary" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={async () => {
                        // Save current code before switching
                        try {
                          if (conversationId && props.getCurrentCode) {
                            const code = props.getCurrentCode();
                            if (code != null) {
                              await supabase
                                .from("conversations")
                                .update({ last_code: code })
                                .eq("id", conversationId);
                            }
                          }
                        } catch (e) {
                          console.warn("Save previous code failed (is last_code column added?)", e);
                        }
                        setConversationId(c.id);
                        setCurrentTitle(c.title || "Untitled");
                        setShowHistory(false);
                        setLoadingHistory(true);
                        const { data: msgs } = await supabase
                          .from("chat_messages")
                          .select("role, content, created_at")
                          .eq("conversation_id", c.id)
                          .order("created_at", { ascending: true });
                    setMessages(
                      (msgs || []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
                    );
                    const { data: convRow } = await supabase
                      .from("conversations")
                      .select("last_code")
                      .eq("id", c.id)
                      .single();
                    setLastCodePreview((convRow as any)?.last_code ?? null);
                    setLoadingHistory(false);
                  }}
                      className="flex-1 text-left"
                    >
                      <div className="text-sm truncate font-medium">
                        {c.title || "Untitled"}
                        {c.id === conversationId && <span className="ml-2 text-xs text-primary">(Active)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</div>
                    </button>
                    <button
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="Delete conversation"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = window.confirm("Delete this conversation? This cannot be undone.");
                        if (!ok) return;
                        const { error } = await supabase
                          .from("conversations")
                          .delete()
                          .eq("id", c.id);
                        if (!error) {
                          // refresh list
                          const { data: convList } = await supabase
                            .from("conversations")
                            .select("id,title,created_at")
                            .order("created_at", { ascending: false })
                            .limit(50);
                          setConversations(convList || []);
                          if (conversationId === c.id) {
                            setConversationId(null);
                            setCurrentTitle("");
                            setMessages([]);
                          }
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewModal && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white border border-border rounded-lg shadow-card w-full max-w-sm p-4">
            <div className="text-sm font-semibold mb-2">Create New Chat</div>
            <label className="text-xs text-muted-foreground">Title</label>
            <input
              className="w-full mt-1 mb-3 px-3 py-2 border border-border rounded outline-none focus:border-primary"
              value={newChatTitle}
              onChange={(e) => setNewChatTitle(e.target.value)}
              placeholder={`New Chat ${new Date().toLocaleDateString()}`}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowNewModal(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) return;
                  // Save current editor code into previous conversation
                  try {
                    if (conversationId && props.getCurrentCode) {
                      const code = props.getCurrentCode();
                      if (code != null) {
                        await supabase
                          .from("conversations")
                          .update({ last_code: code })
                          .eq("id", conversationId);
                      }
                    }
                  } catch (e) {
                    console.warn("Save previous code failed (is last_code column added?)", e);
                  }
                  const { data: conv, error } = await supabase
                    .from("conversations")
                    .insert({ user_id: session.user.id, title: newChatTitle || "New Chat" })
                    .select("id,title")
                    .single();
                  if (!error && conv) {
                    setConversationId(conv.id as string);
                    setCurrentTitle(conv.title || "Untitled");
                    setMessages([]);
                    const { data: convList } = await supabase
                      .from("conversations")
                      .select("id,title,created_at")
                      .order("created_at", { ascending: false })
                      .limit(50);
                    setConversations(convList || []);
                  }
                  setShowNewModal(false);
                }}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

function ChatMessageContent({ role, content }: { role: "user" | "assistant"; content: string }) {
  if (role === "user") {
    return <div className="text-sm whitespace-pre-wrap break-words">{content}</div>;
  }
  return <MarkdownMessage content={content} />;
}

function MarkdownMessage({ content }: { content: string }) {
  // Split by fenced code blocks ```lang\n...```
  const segments: Array<{ type: "code" | "text"; lang?: string; text: string }> = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: "code", lang: match[1]?.toLowerCase(), text: match[2] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", text: content.slice(lastIndex) });
  }

  return (
    <div className="space-y-3">
      {segments.map((seg, i) =>
        seg.type === "code" ? (
          <CodeBlock key={i} lang={seg.lang} code={seg.text} />
        ) : (
          <RichText key={i} text={seg.text} />
        )
      )}
    </div>
  );
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // no-op
    }
  };
  return (
    <div className="relative">
      <div className="absolute right-2 top-2 text-xs text-muted-foreground">
        {lang ? lang.toUpperCase() : "CODE"}
      </div>
      <pre className="bg-background border border-accent/30 rounded p-3 overflow-auto text-sm whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
      <div className="mt-1 flex justify-end">
        <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs">
          Copy
        </Button>
      </div>
    </div>
  );
}

function RichText({ text }: { text: string }) {
  // Basic markdown: headings, lists, paragraphs, inline code, bold, italics
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: Array<{ type: string; content: any }> = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // blank line -> paragraph separator
    if (!line.trim()) {
      i++;
      continue;
    }
    // heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ type: `h${h[1].length}`, content: h[2] });
      i++;
      continue;
    }
    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", content: items });
      continue;
    }
    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", content: items });
      continue;
    }
    // paragraph (collect until blank line or next block)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: "p", content: para.join("\n") });
  }

  const renderInline = (s: string) => {
    // Handle inline code first
    const codeSplit = s.split(/(`[^`]+`)/g);
    return codeSplit.map((part, idx) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={`code-${idx}`} className="bg-muted px-1 py-0.5 rounded border border-border">
            {part.slice(1, -1)}
          </code>
        );
      }
      // bold **text**
      const boldSplit = part.split(/(\*\*[^*]+\*\*)/g);
      return boldSplit.map((bp, bidx) => {
        if (bp.startsWith("**") && bp.endsWith("**")) {
          return <strong key={`b-${idx}-${bidx}`}>{bp.slice(2, -2)}</strong>;
        }
        // italics *text*
        const italSplit = bp.split(/(\*[^*]+\*)/g);
        return italSplit.map((ip, iidx) => {
          if (ip.startsWith("*") && ip.endsWith("*")) {
            return <em key={`i-${idx}-${bidx}-${iidx}`}>{ip.slice(1, -1)}</em>;
          }
          return <span key={`t-${idx}-${bidx}-${iidx}`}>{ip}</span>;
        });
      });
    });
  };

  return (
    <div className="text-sm break-words space-y-2">
      {blocks.map((b, idx) => {
        if (/^h[1-6]$/.test(b.type)) {
          const level = Number(b.type.slice(1));
          const sizes = ["text-2xl", "text-xl", "text-lg", "text-base", "text-sm", "text-xs"] as const;
          const size = sizes[level - 1];
          return (
            <div key={idx} className={`font-semibold ${size}`}> 
              {renderInline(b.content)}
            </div>
          );
        }
        if (b.type === "ul") {
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1">
              {(b.content as string[]).map((it, i2) => (
                <li key={i2}>{renderInline(it)}</li>
              ))}
            </ul>
          );
        }
        if (b.type === "ol") {
          return (
            <ol key={idx} className="list-decimal pl-5 space-y-1">
              {(b.content as string[]).map((it, i2) => (
                <li key={i2}>{renderInline(it)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={idx} className="whitespace-pre-wrap">
            {renderInline(b.content as string)}
          </p>
        );
      })}
    </div>
  );
}
