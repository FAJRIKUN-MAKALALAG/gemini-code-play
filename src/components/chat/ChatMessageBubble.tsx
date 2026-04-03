import React, { useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTypewriter } from "@/hooks/useTypewriter";
import { useTheme } from "@/components/ThemeProvider";

// ── Reusable CodeBlock (dipakai oleh react-markdown custom component)
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { }
  };
  
  return (
    <div className="relative rounded-lg overflow-hidden border my-2 border-zinc-700/80">
      {/* Header bar — selalu dark seperti VS Code */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-zinc-800 border-zinc-700/80">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="text-[10px] transition-colors px-2 py-0.5 rounded font-medium text-zinc-400 hover:text-white hover:bg-zinc-700"
        >
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>
      {/* Body — selalu pakai vscDarkPlus (hitam gelap) di semua mode */}
      <SyntaxHighlighter
        language={lang || 'text'}
        style={vscDarkPlus}
        customStyle={{ margin: 0, padding: '0.875rem 1rem', fontSize: '0.8125rem', background: '#1e1e1e' }}
        wrapLines wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// ── react-markdown powered renderer with colored custom components
function MarkdownMessage({ content }: { content: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="text-[13px] sm:text-sm leading-relaxed space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ── Headings ──────────────────────────────────────────────────
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mt-3 mb-1 pb-1 border-b border-blue-400/40"
              style={{ color: isDark ? '#60a5fa' : '#2563eb' }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mt-2.5 mb-1"
              style={{ color: isDark ? '#a78bfa' : '#7c3aed' }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mt-2 mb-0.5"
              style={{ color: isDark ? '#2dd4bf' : '#0d9488' }}>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold mt-1.5"
              style={{ color: isDark ? '#34d399' : '#059669' }}>
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-medium mt-1"
              style={{ color: isDark ? '#94a3b8' : '#475569' }}>
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-xs font-medium mt-1 uppercase tracking-wide"
              style={{ color: isDark ? '#64748b' : '#64748b' }}>
              {children}
            </h6>
          ),

          // ── Paragraf ─────────────────────────────────────────────────
          p: ({ children }) => (
            <p className="whitespace-pre-wrap my-1 leading-relaxed">{children}</p>
          ),

          // ── Bold & Italic ─────────────────────────────────────────────
          strong: ({ children }) => (
            <strong className="font-bold" style={{ color: isDark ? '#fbbf24' : '#d97706' }}>
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic" style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>
              {children}
            </em>
          ),

          // ── Code block (pre > code) — react-markdown v10 ─────────────
          pre: ({ children }) => {
            const codeEl: any = (children as any)?.[0] ?? children;
            const className: string = codeEl?.props?.className ?? '';
            const lang = /language-(\w+)/.exec(className)?.[1];
            const code = String(codeEl?.props?.children ?? '').replace(/\n$/, '');
            return <CodeBlock code={code} lang={lang} />;
          },

          // ── Inline code ───────────────────────────────────────────────
          code: ({ className, children, ...props }: any) => {
            if (className?.startsWith('language-')) return null;
            return (
              <code
                className="px-1.5 py-0.5 rounded text-[0.8em] font-mono border"
                style={{
                  background: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)',
                  color: isDark ? '#6ee7b7' : '#047857',
                  borderColor: isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.3)',
                }}
                {...props}
              >
                {children}
              </code>
            );
          },

          // ── Lists ─────────────────────────────────────────────────────
          ul: ({ children }) => (
            <ul className="pl-5 space-y-0.5 my-1" style={{ listStyleType: 'disc' }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="pl-5 space-y-0.5 my-1" style={{ listStyleType: 'decimal' }}>{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed" style={{ color: 'inherit' }}>
              <span>{children}</span>
            </li>
          ),

          // ── Blockquote ────────────────────────────────────────────────
          blockquote: ({ children }) => (
            <blockquote
              className="pl-3 py-1 my-2 rounded-r-md text-sm italic"
              style={{
                borderLeft: `3px solid ${isDark ? '#f97316' : '#ea580c'}`,
                background: isDark ? 'rgba(249,115,22,0.08)' : 'rgba(234,88,12,0.06)',
                color: isDark ? '#fdba74' : '#9a3412',
              }}
            >
              {children}
            </blockquote>
          ),

          // ── Horizontal rule ───────────────────────────────────────────
          hr: () => (
            <hr className="my-3 border-0 h-px"
              style={{ background: 'linear-gradient(to right, transparent, currentColor, transparent)', opacity: 0.3 }}
            />
          ),

          // ── Links ─────────────────────────────────────────────────────
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors"
              style={{ color: isDark ? '#818cf8' : '#4f46e5' }}
            >
              {children}
            </a>
          ),

          // ── Table ─────────────────────────────────────────────────────
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-md border"
              style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
              <table className="text-xs w-full border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead style={{ background: isDark ? 'rgba(51,65,85,0.8)' : 'rgba(241,245,249,0.9)' }}>
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold border-b"
              style={{
                color: isDark ? '#94a3b8' : '#475569',
                borderColor: isDark ? '#334155' : '#e2e8f0',
              }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b"
              style={{ borderColor: isDark ? '#1e293b' : '#f1f5f9' }}>
              {children}
            </td>
          ),

          // ── del (strikethrough dari GFM) ──────────────────────────────
          del: ({ children }) => (
            <del className="opacity-60 line-through">{children}</del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Komponen Pembungkus Utama yang diekspor
export const ChatMessageBubble = React.memo(function ChatMessageBubbleRender({ 
  role, 
  content, 
  animate = false 
}: { 
  role: "user" | "assistant"; 
  content: string; 
  animate?: boolean 
}) {
  const displayed = useTypewriter(content, animate);
  
  if (role === "user") {
    return <div className="text-[13px] sm:text-sm whitespace-pre-wrap break-words">{content}</div>;
  }
  return <MarkdownMessage content={displayed} />;
}, (prevProps, nextProps) => {
  // Hanya render ulang jika content berubah, role berubah, atau argumen animate berubah saat runtime
  return prevProps.content === nextProps.content &&
         prevProps.role === nextProps.role &&
         prevProps.animate === nextProps.animate;
});
