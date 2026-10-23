import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Mail, Send, Paperclip, Bold, Italic,
  Link as LinkIcon, List, Loader2, CheckCheck, Check, AlertTriangle,
  RotateCcw, ChevronDown, ChevronUp,
  MoreHorizontal, Archive, Trash2, Ban, Download,
  PanelRightClose, PanelRightOpen,
  User, FileText, Bot,
} from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../../../lib/api/conversations';
import { queryKeys } from '../../../lib/queryKeys';
import { useConversationsCtx } from '../context/ConversationsContext';
import type { ConversationMessage, EmailMessageMeta } from '../../../types/conversation';
import { parseEmailMeta } from '../../../types/conversation';
import { stripQuotedReply, stripQuotedReplyHtml } from '../utils/emailCleaner';
import ThreadInfoPanel from './ThreadInfoPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTs(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return format(d, 'h:mm a');
  return format(d, 'MMM d, h:mm a');
}

function segmentCount(text: string) {
  const len = text.length;
  if (len === 0) return { chars: 0, segs: 0 };
  const segSize = len <= 160 ? 160 : 153;
  return { chars: len, segs: Math.ceil(len / segSize) };
}

// ── Delivery status icon ──────────────────────────────────────────────────────
function DeliveryIcon({ status, channel }: { status: string; channel: string }) {
  if (channel === 'sms') {
    if (status === 'failed') return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
    if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-[var(--primary)]" />;
    if (status === 'sent') return <Check className="w-3.5 h-3.5 text-slate-400" />;
  }
  if (channel === 'email') {
    if (status === 'opened' || status === 'read') return <CheckCheck className="w-3.5 h-3.5 text-[var(--primary)]" />;
    if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-slate-400" />;
    if (status === 'sent') return <Check className="w-3.5 h-3.5 text-slate-400" />;
    if (status === 'failed') return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
  }
  return null;
}

// ── Email HTML viewer ─────────────────────────────────────────────────────────
function EmailHtmlViewer({ html, plain }: { html: string | null; plain: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);
  const [expanded, setExpanded] = useState(false);
  const MAX_COLLAPSED = 650;

  const sanitizedHtml = html ? stripQuotedReplyHtml(html) : null;
  const sanitizedPlain = stripQuotedReply(plain);

  const content = sanitizedHtml
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{margin:0;padding:8px 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.6;color:#e2e8f0;background:transparent;word-break:break-word;}
        a{color:#60a5fa;}img{max-width:100%;height:auto;}
        blockquote{border-left:3px solid #4b5563;margin:8px 0;padding-left:12px;color:#94a3b8;}
        pre,code{background:#1e293b;padding:2px 6px;border-radius:4px;font-size:12px;}
        blockquote, .gmail_quote, .gmail_quote_container, .gmail_attr, div.gmail_quote, #appendonsend, #divRplyFwdMsg { display: none !important; }
      </style></head><body>${sanitizedHtml}</body></html>`
    : null;

  useEffect(() => {
    if (!iframeRef.current || !content) return;
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(content); doc.close();
    const resize = () => setHeight((doc.body?.scrollHeight ?? 120) + 16);
    iframe.addEventListener('load', resize);
    setTimeout(resize, 100);
    return () => iframe.removeEventListener('load', resize);
  }, [content]);

  if (!content) {
    return <pre className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-300 font-sans m-0">{sanitizedPlain}</pre>;
  }

  const isLong = height > MAX_COLLAPSED;
  const displayHeight = isLong && !expanded ? MAX_COLLAPSED : height;

  return (
    <div className="relative w-full">
      <div style={{ height: displayHeight, overflow: 'hidden', transition: 'height 0.2s ease' }}>
        <iframe ref={iframeRef} sandbox="allow-same-origin" scrolling="no" className="w-full border-0 block" style={{ height, background: 'transparent' }} title="email-body" />
      </div>
      {isLong && (
        <button onClick={() => setExpanded(e => !e)} className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white transition-colors">
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" />Show less</> : <><ChevronDown className="w-3.5 h-3.5" />Show more</>}
        </button>
      )}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  msg, channel, convChannel, onRetry, retrying,
}: {
  msg: ConversationMessage;
  channel: string;
  convChannel: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  if (msg.isSystemEvent) {
    return (
      <div className="flex justify-center my-4">
        <span className="text-[11px] font-semibold text-text-muted bg-surface-hover border border-border px-3.5 py-1 rounded-full shadow-xs">
          {msg.body}
        </span>
      </div>
    );
  }

  const isOutbound = msg.direction === 'outbound';
  const meta: EmailMessageMeta | null = parseEmailMeta(msg.attachments);
  const isFailed = msg.status === 'failed';

  if (convChannel === 'email') {
    const fromLabel = isOutbound
      ? `To: ${meta?.toEmail ?? 'Recipient'}`
      : `From: ${meta?.fromEmail ?? msg.sender ?? 'Contact'}`;
    const subject = meta?.subject;

    return (
      <div className={`flex flex-col gap-0 ${isOutbound ? 'items-end' : 'items-start'} mb-4`}>
        <div className="w-full max-w-[92%] rounded-[10px] border border-primary/30 bg-primary/10 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/20 bg-primary/5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-text-muted truncate">{fromLabel}</p>
              {subject && <p className="text-[12px] font-semibold text-text-main truncate leading-tight mt-0.5">{subject}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              {isFailed && isOutbound && (
                <button onClick={onRetry} disabled={retrying} className="flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-300">
                  {retrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Retry
                </button>
              )}
              <span className="text-[10px] text-text-muted">{formatTs(msg.createdAt)}</span>
            </div>
          </div>
          <div className="px-4 py-3 text-text-main">
            <EmailHtmlViewer html={meta?.htmlBody ?? null} plain={msg.body ?? ''} />
          </div>
          {meta?.files && meta.files.length > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {meta.files.map((f, i) => (
                <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-hover rounded-lg text-[12px] text-text-main hover:text-primary border border-border transition-colors">
                  <Paperclip className="w-3 h-3" />{f.name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // SMS / fallback bubble (matching uniform style)
  return (
    <div className={`flex flex-col gap-0 ${isOutbound ? 'items-end' : 'items-start'} mb-4`}>
      <div className="w-full max-w-[85%] rounded-[10px] border border-primary/30 bg-primary/10 overflow-hidden shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-2 border-b border-primary/20 bg-primary/5">
          <span className="text-[11px] font-bold text-text-muted truncate">
            {isOutbound ? 'You' : (msg.sender ?? 'Contact')}
          </span>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {isFailed && isOutbound && (
              <button onClick={onRetry} disabled={retrying} className="flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-300">
                {retrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Retry
              </button>
            )}
            <span className="text-[10px] text-text-muted">{formatTs(msg.createdAt)}</span>
          </div>
        </div>
        <div className="px-4 py-3 text-[13px] text-text-main whitespace-pre-wrap leading-relaxed">
          {stripQuotedReply(msg.body)}
        </div>
      </div>
    </div>
  );
}

// ── Template picker ───────────────────────────────────────────────────────────
function TemplatePicker({ channel, onInsert, onClose }: { channel: string; onInsert: (body: string, subject?: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const { data: templates = [] } = useQuery({
    queryKey: ['conversations', 'templates', channel],
    queryFn: () => conversationsApi.listTemplates(channel !== 'email' && channel !== 'sms' ? undefined : channel),
  });
  const filtered = templates.filter(t => t.name.toLowerCase().includes(q.toLowerCase()) || t.body.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 bg-[#1a1c23] border border-border shadow-2xl ring-1 ring-white/10 rounded-xl overflow-hidden z-[100]">
      <div className="px-3 py-2 border-b border-border">
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search templates…" className="w-full bg-transparent text-[13px] text-white placeholder:text-slate-400 focus:outline-none" />
      </div>
      <div className="max-h-48 overflow-y-auto divide-y divide-white/10">
        {filtered.length === 0 && <p className="text-center text-slate-400 text-[13px] py-6">No templates found</p>}
        {filtered.map(t => (
          <button key={t.id} onClick={() => { onInsert(t.body, t.subject ?? undefined); onClose(); }} className="w-full text-left px-4 py-3 hover:bg-[#242833] transition-colors">
            <p className="text-[13px] font-semibold text-white">{t.name}</p>
            <p className="text-[12px] text-slate-400 truncate mt-0.5">{t.body}</p>
          </button>
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-border bg-[#242833]/50">
        <button onClick={onClose} className="text-[12px] text-slate-400 hover:text-white">Close</button>
      </div>
    </div>
  );
}

function SmsComposer({ conversationId, onSent, onMinimize }: { conversationId: string; onSent?: () => void; onMinimize?: () => void }) {
  const qc = useQueryClient();
  const { composerDraft, setComposerDraft, setIsComposerOpen } = useConversationsCtx();
  const [showTemplates, setShowTemplates] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { chars, segs } = segmentCount(composerDraft);

  const send = useMutation({
    mutationFn: (body: string) => conversationsApi.sendMessage(conversationId, { body }),
    onSuccess: () => {
      setComposerDraft('');
      setIsComposerOpen(false);
      qc.invalidateQueries({ queryKey: queryKeys.conversations.messages(conversationId) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
      onSent?.();
    },
  });

  const [isAiDrafting, setIsAiDrafting] = useState(false);

  const handleAiDraftReply = async () => {
    if (isAiDrafting) return;
    setIsAiDrafting(true);
    try {
      const res = await conversationsApi.generateAiReply(conversationId, 'Draft a concise SMS reply');
      if (res?.draft) {
        setComposerDraft(res.draft);
      }
    } catch (e) {
      console.error('AI draft error:', e);
    } finally {
      setIsAiDrafting(false);
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 180) + 'px'; }
  }, [composerDraft]);

  return (
    <div className="shrink-0 p-4 bg-surface/90 border-t border-border/50 backdrop-blur-md relative">
      <div className="rounded-xl border border-border bg-surface shadow-xs overflow-visible relative">
        <div className="flex items-center justify-between px-3 pt-2 pb-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">SMS Reply</span>
          <button
            type="button"
            onClick={onMinimize}
            className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded transition-colors"
            title="Close reply box"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
        {showTemplates && (
          <TemplatePicker channel="sms" onInsert={(body) => setComposerDraft(body)} onClose={() => setShowTemplates(false)} />
        )}
        <textarea
          ref={textareaRef}
          value={composerDraft}
          onChange={e => setComposerDraft(e.target.value)}
          placeholder="Send SMS… (/ for templates)"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (composerDraft.trim()) send.mutate(composerDraft.trim()); }
            if (e.key === '/' && composerDraft === '') { e.preventDefault(); setShowTemplates(true); }
          }}
          className="w-full bg-transparent p-4 pb-2 text-[13px] outline-none resize-none min-h-[64px] text-text-main placeholder:text-text-muted"
        />
        <div className="flex items-center justify-between px-3 pb-3 gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setShowTemplates(t => !t)} className="p-2 hover:bg-surface-hover rounded-lg text-text-muted hover:text-text-main transition-colors" title="Templates">
              <MessageSquare className="w-4 h-4" />
            </button>
            <button className="p-2 hover:bg-surface-hover rounded-lg text-text-muted hover:text-text-main transition-colors" title="Attach">
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={isAiDrafting}
              onClick={handleAiDraftReply}
              className="flex items-center gap-1.5 px-2.5 py-1 ml-1 rounded-lg bg-surface-hover hover:bg-white/10 text-white border border-border/80 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              title="Read thread and draft smart SMS reply"
            >
              {isAiDrafting ? (
                <Loader2 className="w-3 h-3 animate-spin text-white" />
              ) : (
                <Bot className="w-3 h-3 text-white" />
              )}
              <span>AI Reply</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-text-muted">
              {chars}/{segs > 1 ? `${segs} SMS` : '160'}
            </span>
            <button
              onClick={() => { if (composerDraft.trim()) send.mutate(composerDraft.trim()); }}
              disabled={!composerDraft.trim() || send.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send SMS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Email Composer ────────────────────────────────────────────────────────────
function EmailComposer({ conversationId, defaultSubject, onSent, onMinimize }: { conversationId: string; defaultSubject: string; onSent?: () => void; onMinimize?: () => void }) {
  const qc = useQueryClient();
  const { composerDraft, setComposerDraft, composerSubject, setComposerSubject, setIsComposerOpen } = useConversationsCtx();
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!composerSubject && defaultSubject) {
      setComposerSubject(defaultSubject.startsWith('Re:') ? defaultSubject : `Re: ${defaultSubject}`);
    }
  }, [defaultSubject]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px'; }
  }, [composerDraft]);

  const [isAiDrafting, setIsAiDrafting] = useState(false);

  const handleAiDraftReply = async () => {
    if (isAiDrafting) return;
    setIsAiDrafting(true);
    try {
      const res = await conversationsApi.generateAiReply(conversationId);
      if (res?.draft) {
        setComposerDraft(res.draft);
        if (!composerSubject && defaultSubject) {
          setComposerSubject(defaultSubject.startsWith('Re:') ? defaultSubject : `Re: ${defaultSubject}`);
        }
      }
    } catch (e) {
      console.error('AI draft error:', e);
    } finally {
      setIsAiDrafting(false);
    }
  };

  const doSend = (sendAndClose: boolean) => {
    if (!composerDraft.trim()) return;
    const ccArr = cc.split(',').map(s => s.trim()).filter(Boolean);
    const bccArr = bcc.split(',').map(s => s.trim()).filter(Boolean);
    send.mutate({ body: composerDraft, subject: composerSubject, sendAndClose, ccArr, bccArr });
  };

  const send = useMutation({
    mutationFn: ({ body, subject, sendAndClose, ccArr, bccArr }: any) =>
      conversationsApi.sendMessage(conversationId, {
        body,
        subject,
        cc: ccArr,
        bcc: bccArr,
        includeSignature,
        sendAndClose,
      }),
    onSuccess: () => {
      setComposerDraft('');
      setIsComposerOpen(false);
      qc.invalidateQueries({ queryKey: queryKeys.conversations.messages(conversationId) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
      onSent?.();
    },
  });

  return (
    <div className="shrink-0 p-4 bg-surface/90 border-t border-border/50 backdrop-blur-md relative">
      <div className="rounded-xl border border-border bg-surface shadow-xs overflow-visible relative">
        {showTemplates && (
          <TemplatePicker
            channel="email"
            onInsert={(tmplBody, tmplSubject) => {
              setComposerDraft(tmplBody);
              if (tmplSubject && !defaultSubject) setComposerSubject(tmplSubject);
            }}
            onClose={() => setShowTemplates(false)}
          />
        )}

        {/* Subject */}
        <div className="flex items-center px-3 py-2 border-b border-border/40 gap-2">
          <span className="text-[11px] text-text-muted font-bold uppercase tracking-wide w-12">Subject</span>
          <input
            value={composerSubject}
            onChange={e => setComposerSubject(e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-text-main placeholder:text-text-muted focus:outline-none"
            placeholder="Subject"
          />
          <button
            type="button"
            onClick={onMinimize}
            className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded transition-colors"
            title="Close reply box"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* CC / BCC */}
        <div className="border-b border-border/40">
          <button onClick={() => setShowCcBcc(p => !p)} className="flex items-center gap-1 px-3 py-1.5 text-[11px] text-text-muted hover:text-text-main transition-colors font-bold uppercase tracking-wide">
            {showCcBcc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            CC / BCC
          </button>
          {showCcBcc && (
            <div className="px-3 pb-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-text-muted w-8">CC</span>
                <input value={cc} onChange={e => setCc(e.target.value)} placeholder="Comma-separated emails" className="flex-1 bg-transparent text-[13px] text-text-main placeholder:text-text-muted focus:outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-text-muted w-8">BCC</span>
                <input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="Comma-separated emails" className="flex-1 bg-transparent text-[13px] text-text-main placeholder:text-text-muted focus:outline-none" />
              </div>
            </div>
          )}
        </div>

        {/* Formatting toolbar */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/40">
          <button className="p-1.5 hover:bg-surface-hover rounded text-text-muted hover:text-text-main transition-colors"><Bold className="w-3.5 h-3.5" /></button>
          <button className="p-1.5 hover:bg-surface-hover rounded text-text-muted hover:text-text-main transition-colors"><Italic className="w-3.5 h-3.5" /></button>
          <div className="w-px h-4 bg-border mx-1" />
          <button className="p-1.5 hover:bg-surface-hover rounded text-text-muted hover:text-text-main transition-colors"><LinkIcon className="w-3.5 h-3.5" /></button>
          <button className="p-1.5 hover:bg-surface-hover rounded text-text-muted hover:text-text-main transition-colors"><List className="w-3.5 h-3.5" /></button>
        </div>

        {/* Body */}
        <textarea
          ref={textareaRef}
          value={composerDraft}
          onChange={e => setComposerDraft(e.target.value)}
          placeholder="Type your message… (/ for templates)"
          onKeyDown={e => {
            if (e.key === '/' && composerDraft === '') { e.preventDefault(); setShowTemplates(true); }
          }}
          className="w-full bg-transparent p-4 text-[13px] outline-none resize-none min-h-[80px] text-text-main placeholder:text-text-muted"
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-3 pb-3 gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => setShowTemplates(t => !t)} className="p-2 hover:bg-surface-hover rounded-lg text-text-muted hover:text-text-main transition-colors" title="Templates">
              <MessageSquare className="w-4 h-4" />
            </button>
            <button className="p-2 hover:bg-surface-hover rounded-lg text-text-muted hover:text-text-main transition-colors" title="Attach">
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIncludeSignature(s => !s)}
              className={`p-2 hover:bg-surface-hover rounded-lg transition-colors ${includeSignature ? 'text-primary font-bold bg-primary/10' : 'text-text-muted'}`}
              title="Toggle signature"
            >
              <span className="text-[12px] font-bold">Sig</span>
            </button>
            <button
              type="button"
              disabled={isAiDrafting}
              onClick={handleAiDraftReply}
              className="flex items-center gap-1.5 px-3 py-1.5 ml-1.5 rounded-lg bg-surface-hover hover:bg-white/10 text-white border border-border/80 text-[12px] font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              title="Read thread & draft smart AI reply"
            >
              {isAiDrafting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Bot className="w-3.5 h-3.5 text-white" />
              )}
              <span>AI Reply</span>
            </button>
          </div>
          <div className="flex items-center ml-auto">
            <button
              onClick={() => doSend(false)}
              disabled={!composerDraft.trim() || send.isPending}
              className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg ml-2 shadow-xs"
            >
              {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Email
            </button>
          </div>
        </div>
        {send.isError && (
          <div className="px-4 pb-3">
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[12px]">
              {(send.error as any)?.response?.data?.error || (send.error as any)?.message || 'Failed to send email.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Thread Pane ───────────────────────────────────────────────────────────────
export default function ThreadPane() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const {
    selectedId, setSelectedId,
    isComposerOpen, setIsComposerOpen,
  } = useConversationsCtx();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showActions, setShowActions] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [infoPanelTab, setInfoPanelTab] = useState<'contact' | 'notes' | 'ai'>('contact');
  const wasRightPanelOpenBeforeCompose = useRef(false);

  const { data: conv, isLoading: convLoading } = useQuery({
    queryKey: queryKeys.conversations.detail(selectedId!),
    queryFn: () => conversationsApi.get(selectedId!),
    enabled: !!selectedId,
    staleTime: 15_000,
  });

  const { data: messages = [], isLoading: msgsLoading, refetch: refetchMsgs } = useQuery({
    queryKey: queryKeys.conversations.messages(selectedId!),
    queryFn: () => conversationsApi.getMessages(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 15_000,
  });

  const patch = useMutation({
    mutationFn: (data: Parameters<typeof conversationsApi.patch>[1]) => conversationsApi.patch(selectedId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.detail(selectedId!) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    },
  });

  const del = useMutation({
    mutationFn: () => conversationsApi.delete(selectedId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
      setSelectedId(null);
    },
  });

  const retryMsg = useMutation({
    mutationFn: (msgId: string) => conversationsApi.retryMessage(selectedId!, msgId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.conversations.messages(selectedId!) }),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Empty state
  if (!selectedId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-transparent text-center p-8">
        <h3 className="text-base font-bold text-text-main mb-1">No conversation selected</h3>
        <p className="text-sm text-text-muted">Choose a conversation from the list to view messages.</p>
      </div>
    );
  }

  if (convLoading || msgsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface/20">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface/20 text-center p-8">
        <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
        <p className="text-text-muted text-sm mb-3">Failed to load conversation or access denied.</p>
        <button onClick={() => refetchMsgs()} className="btn-primary text-[13px]">Retry</button>
      </div>
    );
  }

  const contact = conv?.contact;
  const displayName = contact
    ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || contact.email || 'Unknown'
    : conv?.subject || 'Unknown';
  const crmContactId = contact?.id;

  const channelId = conv?.channel;
  const identifier =
    conv?.channel === 'sms'
      ? (conv as any).twilioPhoneNumber ?? contact?.phone ?? ''
      : contact?.email ?? '';

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-surface/30 backdrop-blur-sm">
        {/* ── Thread header ── */}
        <div className="min-h-[64px] border-b border-border/50 bg-surface/80 flex items-center px-5 py-2.5 gap-4 shrink-0 backdrop-blur-md relative z-30">
          {/* Contact info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-bold text-text-main truncate">{displayName}</h2>
              <p className="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
                {channelId === 'email' ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                {identifier || channelId}
              </p>
            </div>
          </div>

          {/* Actions: 3-dots at top right, Hide/Show Panel underneath in bottom left */}
          <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-1.5 py-0.5">
            {/* Top Right: Overflow actions 3 dots */}
            <div className="relative self-end">
              <button
                onClick={() => setShowActions(p => !p)}
                className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                title="More actions"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showActions && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowActions(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-[100] w-52 bg-[#1a1c23] border border-border/80 shadow-2xl ring-1 ring-white/10 rounded-xl overflow-hidden py-1">
                    <button onClick={() => { patch.mutate({ status: 'archived' }); setShowActions(false); }} className="w-full text-left px-4 py-2.5 text-[13px] text-slate-300 hover:bg-[#242833] hover:text-white transition-colors flex items-center gap-2.5">
                      <Archive className="w-4 h-4" /> Archive
                    </button>
                    <button onClick={() => { patch.mutate({ isBlocked: true }); setShowActions(false); }} className="w-full text-left px-4 py-2.5 text-[13px] text-slate-300 hover:bg-[#242833] hover:text-white transition-colors flex items-center gap-2.5">
                      <Ban className="w-4 h-4" /> Block contact
                    </button>
                    <button
                      onClick={async () => {
                        const data = await conversationsApi.export(selectedId!);
                        const url = URL.createObjectURL(new Blob([data], { type: 'text/plain' }));
                        const a = document.createElement('a'); a.href = url; a.download = `conversation-${selectedId}.txt`; a.click();
                        setShowActions(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-slate-300 hover:bg-[#242833] hover:text-white transition-colors flex items-center gap-2.5"
                    >
                      <Download className="w-4 h-4" /> Export thread
                    </button>
                    <div className="border-t border-white/10">
                      <button
                        onClick={() => {
                          if (confirm('Delete this conversation permanently?')) { del.mutate(); setShowActions(false); }
                        }}
                        className="w-full text-left px-4 py-2.5 text-[13px] text-red-400 hover:bg-[#242833] hover:text-red-300 transition-colors flex items-center gap-2.5"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Message timeline ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-text-muted">No messages yet. Send the first one below.</p>
            </div>
          )}
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              channel={msg.channel ?? conv.channel}
              convChannel={conv.channel}
              onRetry={() => retryMsg.mutate(msg.id)}
              retrying={retryMsg.isPending && retryMsg.variables === msg.id}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Composer / Collapsible Message Bar (Closed by default, click anywhere to open and minimize right panel) ── */}
        <div className="shrink-0">
          {!isComposerOpen ? (
            <div
              onClick={() => {
                wasRightPanelOpenBeforeCompose.current = isRightPanelOpen;
                setIsComposerOpen(true);
                setIsRightPanelOpen(false);
              }}
              className="px-6 py-3.5 bg-surface/90 hover:bg-surface-hover/80 border-t border-border/50 backdrop-blur-md flex items-center justify-center z-10 transition-colors cursor-pointer group"
            >
              <span className="text-[12px] text-text-muted group-hover:text-text-main transition-colors text-center font-medium">
                Click to compose an email or reply
              </span>
            </div>
          ) : (
            conv.channel === 'email' ? (
              <EmailComposer
                conversationId={conv.id}
                defaultSubject={conv.subject ?? ''}
                onMinimize={() => {
                  setIsComposerOpen(false);
                  if (wasRightPanelOpenBeforeCompose.current) {
                    setIsRightPanelOpen(true);
                  }
                }}
              />
            ) : (
              <SmsComposer
                conversationId={conv.id}
                onMinimize={() => {
                  setIsComposerOpen(false);
                  if (wasRightPanelOpenBeforeCompose.current) {
                    setIsRightPanelOpen(true);
                  }
                }}
              />
            )
          )}
        </div>
      </div>

      {/* ── Right info panel (Foldable or Minimized slim icon rail) ── */}
      {isRightPanelOpen ? (
        <ThreadInfoPanel
          conv={conv}
          initialTab={infoPanelTab}
          onClose={() => setIsRightPanelOpen(false)}
        />
      ) : (
        <div className="w-12 shrink-0 border-l border-border/50 bg-surface/85 backdrop-blur-md flex flex-col items-center py-3.5 gap-3 z-10">
          <button
            onClick={() => { setInfoPanelTab('contact'); setIsRightPanelOpen(true); }}
            className="p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
            title="Contact Profile"
          >
            <User className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setInfoPanelTab('notes'); setIsRightPanelOpen(true); }}
            className="p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
            title="Internal Notes"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setInfoPanelTab('ai'); setIsRightPanelOpen(true); }}
            className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-surface-hover transition-colors"
            title="AI Assistant"
          >
            <Bot className="w-4 h-4 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

