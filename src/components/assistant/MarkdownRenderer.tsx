import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words text-[14px] leading-relaxed select-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Remote images must show as plain links with visible domain (Spec Section 2.20)
          img: ({ src, alt }) => {
            if (!src) return null;
            let domain = '';
            try {
              domain = new URL(src).hostname;
            } catch {
              domain = 'external link';
            }
            return (
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 my-1 text-xs rounded bg-bg-secondary text-primary hover:underline border border-border"
              >
                <span>[Image: {alt || 'Attachment'}] ({domain})</span>
              </a>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border/70 pl-3.5 my-2.5 text-text-muted">
              {children}
            </blockquote>
          ),
          // Code block with language tag and Copy button
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !String(children).includes('\n');
            const codeString = String(children).replace(/\n$/, '');

            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded text-[13px] font-mono bg-bg-secondary text-text-main border border-border/50" {...props}>
                  {children}
                </code>
              );
            }

            return <CodeBlock language={match ? match[1] : 'code'} code={codeString} />;
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium break-all"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-xl border border-border/80 bg-bg-card/40 shadow-xs">
              <table className="min-w-full divide-y divide-border/80 text-left text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#22252B] sticky top-0 z-10">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 font-semibold text-text-main border-b border-border text-[12px] tracking-wide whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2.5 text-text-main/90 border-b border-border/40 text-[13px] leading-relaxed">
              {children}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-surface-hover/40 transition-colors odd:bg-transparent even:bg-surface-hover/15">
              {children}
            </tr>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-border bg-[#18181b] text-zinc-100 font-mono text-[13px]">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#27272a] text-zinc-400 text-xs border-b border-zinc-700/50">
        <span className="uppercase tracking-wider font-semibold text-[11px]">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code"
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-zinc-300 hover:text-white hover:bg-zinc-700/60 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy code'}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto leading-relaxed m-0 text-zinc-100 bg-transparent">
        <code>{code}</code>
      </pre>
    </div>
  );
}
