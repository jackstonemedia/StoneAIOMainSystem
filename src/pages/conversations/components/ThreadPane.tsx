import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Mail, Send, Paperclip, Bold, Italic,
  Link as LinkIcon, List, Loader2, CheckCheck, Check, AlertTriangle,
  RotateCcw, ChevronDown, ChevronUp, ExternalLink,
  MoreHorizontal, Archive, Trash2, Ban, Download,
  Clock, EyeOff, Eye,
} from 'lucide-react';
import { format, addHours, addDays, nextMonday } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../../../lib/api/conversations';
import { queryKeys } from '../../../lib/queryKeys';
import { useConversationsCtx } from '../context/ConversationsContext';
import type { ConversationMessage, EmailMessageMeta } from '../../../types/conversation';
import { parseEmailMeta } from '../../../types/conversation';
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
  const MAX_COLLAPSED = 220;

  const content = html
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{margin:0;padding:8px 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.6;color:#e2e8f0;background:transparent;word-break:break-word;}
        a{color:#60a5fa;}img{max-width:100%;height:auto;}
        blockquote{border-left:3px solid #4b5563;margin:8px 0;padding-left:12px;color:#94a3b8;}
        pre,code{background:#1e293b;padding:2px 6px;border-radius:4px;font-size:12px;}
      </style></head><body>${html}</body></html>`
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
    return <pre className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-300 font-sans m-0">{plain}</pre>;
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

  if (convChannel === 'email' && meta) {
    const fromLabel = isOutbound ? `To: ${meta.toEmail ?? ''}` : `From: ${meta.fromEmail ?? msg.sender ?? ''}`;
    return (
      <div className={`flex flex-col gap-0 ${isOutbound ? 'items-end' : 'items-start'} mb-4`}>
        <div className={`w-full max-w-[92%] rounded-[10px] border overflow-hidden shadow-sm ${isOutbound ? 'bg-primary/10 border-primary/30' : 'bg-surface border-border'}`}>
          <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isOutbound ? 'border-primary/20 bg-primary/5' : 'border-border bg-surface-hover/50'}`}>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-text-muted truncate">{fromLabel}</p>
              {meta.subject && <p className="text-[12px] font-semibold text-text-main truncate leading-tight mt-0.5">{meta.subject}</p>}
            </div>
            <span className="text-[10px] text-text-muted shrink-0 ml-3">{formatTs(msg.createdAt)}</span>
          </div>
          <div className="px-4 py-3 text-text-main">
            <EmailHtmlViewer html={meta.htmlBody ?? null} plain={msg.body ?? ''} />
          </div>
          {meta.files && meta.files.length > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {meta.files.map((f, i) => (
                <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-hover rounded-lg text-[12px] text-text-main hover:text-primary border border-border transition-colors">
                  <Paperclip className="w-3 h-3" />{f.name}
                </a>
              ))}
            </div>
          )}
        </div>
        {isOutbound && (
          <div className="flex items-center gap-1.5 px-1 mt-1">
            <DeliveryIcon status={msg.status} channel="email" />
            <span className="text-[10px] text-text-muted">Sent · {formatTs(msg.createdAt)}</span>
            {isFailed && (
              <button onClick={onRetry} disabled={retrying} className="ml-2 flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-300">
                {retrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Retry
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // SMS / fallback bubble
  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-4 group`}>
      {!isOutbound && (
        <div className="w-6 h-6 rounded-full bg-surface-hover border border-border flex items-center justify-center mr-2 mt-1 shrink-0 text-[10px] font-bold text-text-main shadow-xs">
          {(msg.sender ?? '?')[0]?.toUpperCase()}
        </div>
      )}
      <div className="max-w-[75%]">
        <div className={`px-3.5 py-2.5 text-[13px] leading-relaxed rounded-2xl shadow-sm ${
          isOutbound
            ? 'bg-primary text-white rounded-tr-none'
            : 'bg-surface border border-border text-text-main rounded-tl-none'
        }`}>
          {msg.body}
        </div>
        <div className={`flex items-center gap-1.5 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-text-muted">{formatTs(msg.createdAt)}</span>
          {isOutbound && <DeliveryIcon status={msg.status} channel="sms" />}
          {isFailed && isOutbound && (
            <button onClick={onRetry} disabled={retrying} className="flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-300">
              {retrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Retry
            </button>
          )}
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
    <div className="absolute bottom-full mb-2 left-0 right-0 bg-surface border border-border shadow-luxury ring-1 ring-white/5 rounded-xl overflow-hidden z-50">
      <div className="px-3 py-2 border-b border-border">
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search templates…" className="w-full bg-transparent text-[13px] text-text-main placeholder:text-text-muted focus:outline-none" />
      </div>
      <div className="max-h-48 overflow-y-auto divide-y divide-border/30">
        {filtered.length === 0 && <p className="text-center text-text-muted text-[13px] py-6">No templates found</p>}
        {filtered.map(t => (
          <button key={t.id} onClick={() => { onInsert(t.body, t.subject ?? undefined); onClose(); }} className="w-full text-left px-4 py-3 hover:bg-surface-hover transition-colors">
            <p className="text-[13px] font-semibold text-text-main">{t.name}</p>
            <p className="text-[12px] text-text-muted truncate mt-0.5">{t.body}</p>
          </button>
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-border bg-surface-hover/50">
        <button onClick={onClose} className="text-[12px] text-text-muted hover:text-text-main">Close</button>
      </div>
    </div>
  );
}

function SmsComposer({ conversationId, onSent, onMinimize }: { conversationId: string; onSent?: () => void; onMinimize?: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { chars, segs } = segmentCount(text);

  const send = useMutation({
    mutationFn: (body: string) => conversationsApi.sendMessage(conversationId, { body }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: queryKeys.conversations.messages(conversationId) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
      onSent?.();
    },
  });

  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 180) + 'px'; }
  }, [text]);

  return (
    <div className="shrink-0 p-4 bg-surface/90 border-t border-border/50 backdrop-blur-md relative">
      <div className="rounded-xl border border-border bg-surface shadow-xs overflow-visible relative">
        {onMinimize && (
          <div className="flex items-center justify-between px-3 pt-2 pb-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">SMS Reply</span>
            <button
              type="button"
              onClick={onMinimize}
              className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded transition-colors"
              title="Hide reply bar to see messages better"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {showTemplates && (
          <TemplatePicker channel="sms" onInsert={(body) => setText(body)} onClose={() => setShowTemplates(false)} />
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Send SMS… (/ for templates)"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) send.mutate(text.trim()); }
            if (e.key === '/' && text === '') { e.preventDefault(); setShowTemplates(true); }
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
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-text-muted">
              {chars}/{segs > 1 ? `${segs} SMS` : '160'}
            </span>
            <button
              onClick={() => { if (text.trim()) send.mutate(text.trim()); }}
              disabled={!text.trim() || send.isPending}
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
function EmailComposer({ conversationId, subject: defaultSubject, onSent, onMinimize }: { conversationId: string; subject: string; onSent?: () => void; onMinimize?: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState(defaultSubject ? `Re: ${defaultSubject}` : '');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px'; }
  }, [body]);

  const doSend = (sendAndClose: boolean) => {
    if (!body.trim()) return;
    const ccArr = cc.split(',').map(s => s.trim()).filter(Boolean);
    const bccArr = bcc.split(',').map(s => s.trim()).filter(Boolean);
    send.mutate({ body, subject, sendAndClose, ccArr, bccArr });
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
      setBody('');
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
              setBody(tmplBody);
              if (tmplSubject && !defaultSubject) setSubject(tmplSubject);
            }}
            onClose={() => setShowTemplates(false)}
          />
        )}

        {/* Subject */}
        <div className="flex items-center px-3 py-2 border-b border-border/40 gap-2">
          <span className="text-[11px] text-text-muted font-bold uppercase tracking-wide w-12">Subject</span>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-text-main placeholder:text-text-muted focus:outline-none"
            placeholder="Subject"
          />
          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded transition-colors"
              title="Hide reply bar to see emails better"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
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
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Type your message… (/ for templates)"
          onKeyDown={e => {
            if (e.key === '/' && body === '') { e.preventDefault(); setShowTemplates(true); }
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
          </div>
          <div className="flex items-center gap-0 rounded-lg overflow-hidden shadow-xs">
            <button
              onClick={() => doSend(false)}
              disabled={!body.trim() || send.isPending}
              className="btn-primary flex items-center gap-2 rounded-r-none"
            >
              {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Email
            </button>
            <button
              onClick={() => doSend(true)}
              disabled={!body.trim() || send.isPending}
              className="px-2 py-2 bg-primary/80 hover:bg-primary text-white border-l border-white/20 disabled:opacity-40 transition-colors"
              title="Send & Close"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Snooze picker (header) ────────────────────────────────────────────────────
function SnoozeMenu({ onPick }: { onPick: (until: string) => void }) {
  const [custom, setCustom] = useState('');
  const opts = [
    { label: '1 hour', fn: () => addHours(new Date(), 1).toISOString() },
    { label: 'Tomorrow 9 AM', fn: () => { const d = addDays(new Date(), 1); d.setHours(9, 0, 0, 0); return d.toISOString(); } },
    { label: 'Next week', fn: () => nextMonday(new Date()).toISOString() },
  ];
  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-surface border border-border shadow-luxury ring-1 ring-white/5 rounded-xl overflow-hidden text-[13px]">
      {opts.map(o => (
        <button key={o.label} onClick={() => onPick(o.fn())} className="w-full text-left px-4 py-2.5 text-text-main hover:bg-surface-hover transition-colors">{o.label}</button>
      ))}
      <div className="px-3 py-2 border-t border-border">
        <input type="datetime-local" value={custom} onChange={e => setCustom(e.target.value)} className="w-full bg-surface-hover border border-border text-text-main text-[12px] px-2 py-1 rounded focus:outline-none" />
        {custom && (
          <button onClick={() => onPick(new Date(custom).toISOString())} className="mt-1.5 w-full py-1 bg-primary text-white text-[12px] font-semibold rounded">
            Set snooze
          </button>
        )}
      </div>
    </div>
  );
}

// ── Thread Pane ───────────────────────────────────────────────────────────────
export default function ThreadPane() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { selectedId, setSelectedId } = useConversationsCtx();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isComposerHidden, setIsComposerHidden] = useState(false);

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

  const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'archived', label: 'Archived' },
  ];

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-surface/30 backdrop-blur-sm">
        {/* ── Thread header ── */}
        <div className="h-[60px] border-b border-border/50 bg-surface/80 flex items-center px-5 gap-4 shrink-0 backdrop-blur-md">
          {/* Contact info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-surface-hover border border-border flex items-center justify-center text-text-main font-bold text-sm shrink-0 overflow-hidden shadow-xs">
              {contact?.avatarUrl
                ? <img src={contact.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                : displayName[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-bold text-text-main truncate">{displayName}</h2>
                {crmContactId && (
                  <button
                    onClick={() => navigate(`/crm/contacts/${crmContactId}`)}
                    className="text-primary text-[12px] font-semibold flex items-center gap-1 hover:underline shrink-0"
                  >
                    View Profile <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-text-muted flex items-center gap-1.5">
                {channelId === 'email' ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                {identifier || channelId}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Composer / Hide Message Bar button */}
            <button
              onClick={() => setIsComposerHidden(p => !p)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface border border-border hover:border-primary/40 text-text-muted hover:text-text-main text-[12px] font-semibold rounded-lg transition-colors shadow-xs"
              title={isComposerHidden ? "Show message bar" : "Hide message bar to see emails better"}
            >
              {isComposerHidden ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Show Message Bar</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Hide Message Bar</span>
                </>
              )}
            </button>

            {/* Status selector */}
            <div className="relative">
              <button
                onClick={() => { setShowStatus(p => !p); setShowActions(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border hover:border-primary/40 text-text-main text-[12px] font-semibold rounded-lg transition-colors shadow-xs"
              >
                {conv.status.charAt(0).toUpperCase() + conv.status.slice(1)}
                <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
              </button>
              {showStatus && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setShowStatus(false); setShowSnooze(false); }} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-44 bg-surface border border-border shadow-luxury ring-1 ring-white/10 rounded-xl overflow-hidden py-1">
                    {STATUS_OPTIONS.map(o => (
                      <button
                        key={o.value}
                        onClick={() => { patch.mutate({ status: o.value as any }); setShowStatus(false); }}
                        className="w-full text-left px-4 py-2.5 text-[13px] text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors flex items-center justify-between"
                      >
                        {o.label}
                        {conv.status === o.value && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    ))}
                    <div className="border-t border-border">
                      <div className="relative">
                        <button onClick={() => setShowSnooze(p => !p)} className="w-full text-left px-4 py-2.5 text-[13px] text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" /> Snooze…
                        </button>
                        {showSnooze && (
                          <SnoozeMenu onPick={(until) => {
                            patch.mutate({ status: 'snoozed', snoozedUntil: until });
                            setShowSnooze(false);
                            setShowStatus(false);
                          }} />
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Overflow actions menu */}
            <div className="relative">
              <button
                onClick={() => { setShowActions(p => !p); setShowStatus(false); }}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showActions && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowActions(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-52 bg-surface border border-border shadow-luxury ring-1 ring-white/10 rounded-xl overflow-hidden py-1">
                    <button onClick={() => { patch.mutate({ status: 'archived' }); setShowActions(false); }} className="w-full text-left px-4 py-2.5 text-[13px] text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors flex items-center gap-2.5">
                      <Archive className="w-4 h-4" /> Archive
                    </button>
                    <button onClick={() => { patch.mutate({ isBlocked: true }); setShowActions(false); }} className="w-full text-left px-4 py-2.5 text-[13px] text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors flex items-center gap-2.5">
                      <Ban className="w-4 h-4" /> Block contact
                    </button>
                    <button
                      onClick={async () => {
                        const data = await conversationsApi.export(selectedId!);
                        const url = URL.createObjectURL(new Blob([data], { type: 'text/plain' }));
                        const a = document.createElement('a'); a.href = url; a.download = `conversation-${selectedId}.txt`; a.click();
                        setShowActions(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors flex items-center gap-2.5"
                    >
                      <Download className="w-4 h-4" /> Export thread
                    </button>
                    <div className="border-t border-border">
                      <button
                        onClick={() => {
                          if (confirm('Delete this conversation permanently?')) { del.mutate(); setShowActions(false); }
                        }}
                        className="w-full text-left px-4 py-2.5 text-[13px] text-red-400 hover:bg-surface-hover hover:text-red-300 transition-colors flex items-center gap-2.5"
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

        {/* ── Composer / Collapsible Message Bar ── */}
        <div data-tour="inbox-composer" className="shrink-0">
          {isComposerHidden ? (
            <div className="px-6 py-2.5 bg-surface/90 border-t border-border/50 backdrop-blur-md flex items-center justify-between z-10 transition-all">
              <span className="text-[12px] text-text-muted italic flex items-center gap-2">
                <EyeOff className="w-3.5 h-3.5 text-text-muted/70" />
                Message bar hidden — email reading view expanded
              </span>
              <button
                onClick={() => setIsComposerHidden(false)}
                className="btn-secondary text-[12px] py-1 px-3 flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-primary" /> Show Reply Box
              </button>
            </div>
          ) : (
            conv.channel === 'email' ? (
              <EmailComposer conversationId={conv.id} subject={conv.subject ?? ''} onMinimize={() => setIsComposerHidden(true)} />
            ) : (
              <SmsComposer conversationId={conv.id} onMinimize={() => setIsComposerHidden(true)} />
            )
          )}
        </div>
      </div>

      {/* ── Right info panel ── */}
      <ThreadInfoPanel conv={conv} />
    </div>
  );
}
