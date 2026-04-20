import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, FolderPlus, Search, ChevronDown, X, Info,
  Smile, Tag, Bold, Italic, Underline, AlignLeft, AlignCenter,
  AlignRight, List, Strikethrough, Code, Link2, Image,
  Upload, Send, Mail, MessageSquare, Paperclip,
} from 'lucide-react';

// ──────────────── Types ─────────────────────────────────────

interface Snippet {
  id: string;
  name: string;
  body: string;
  folder?: string;
  type: 'text' | 'email';
  dateUpdated: string;
}

// ──────────────── Modals ─────────────────────────────────────

function TextSnippetModal({ onClose }: { onClose: () => void }) {
  const [name, setName]       = useState('');
  const [body, setBody]       = useState('');
  const [url, setUrl]         = useState('');
  const [phone, setPhone]     = useState('');

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-surface border border-border rounded-2xl shadow-luxury w-full max-w-2xl overflow-hidden flex"
        onClick={e => e.stopPropagation()}
      >
        {/* Form side */}
        <div className="flex-1 flex flex-col">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-text-main">Create Text Snippet</h2>
              <p className="text-[11.5px] text-text-muted mt-0.5">Create and reuse text snippets for quick access via shortcuts. Save your go-to phrases and speed up your workflow.</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-hover transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 space-y-4 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-text-muted flex items-center gap-1">Name <span className="text-accent-red">*</span></label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Enter Snippet Name"
                className="w-full px-3 py-2 bg-bg border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-text-muted flex items-center gap-1">Snippets Body <span className="text-accent-red">*</span></label>
              <div className="border border-border rounded-[8px] overflow-hidden bg-bg">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/50">
                  <button className="p-1 rounded text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"><Smile className="w-3.5 h-3.5" /></button>
                  <button className="p-1 rounded text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"><Tag className="w-3.5 h-3.5" /></button>
                </div>
                <textarea
                  value={body} onChange={e => setBody(e.target.value)}
                  placeholder="Type a message"
                  rows={5}
                  className="w-full px-3 py-2 bg-transparent text-[13px] text-text-main resize-none focus:outline-none placeholder:text-text-muted"
                />
                <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/50 text-[11px] text-text-muted">
                  <span>Approximate Cost: $0 <Info className="w-3 h-3 inline" /></span>
                  <span>{body.length} characters | {body.split(/\s+/).filter(Boolean).length} words | 0 segs</span>
                </div>
              </div>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-[8px] text-[12.5px] font-medium text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
              <Upload className="w-3.5 h-3.5" /> Add Attachment
            </button>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-text-muted">Add file through URL</label>
              <div className="flex gap-2">
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Enter URL"
                  className="flex-1 px-3 py-2 bg-bg border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all placeholder:text-text-muted" />
                <button className="px-3 py-2 border border-border rounded-[8px] text-[12.5px] font-medium text-text-muted hover:bg-surface-hover transition-colors flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-text-muted">Test Snippet</label>
              <div className="flex gap-2">
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter Phone Number"
                  className="flex-1 px-3 py-2 bg-bg border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all placeholder:text-text-muted" />
                <button className="px-3 py-2 border border-border rounded-[8px] text-[12.5px] font-medium text-text-muted hover:bg-surface-hover transition-colors flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </div>
            </div>
          </div>
          <div className="px-5 py-3.5 border-t border-border flex justify-end gap-3 bg-surface-hover/30">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-[8px] text-[13px] font-medium text-text-muted hover:bg-surface-hover transition-colors">Cancel</button>
            <button className="px-5 py-2 rounded-[8px] text-[13px] font-semibold text-bg hover:opacity-90 transition-all" style={{ backgroundColor: 'var(--primary)' }}>Save</button>
          </div>
        </div>

        {/* Phone preview */}
        <div className="w-44 border-l border-border bg-bg flex flex-col items-center py-5 px-2 shrink-0">
          <div className="w-full rounded-[22px] border-2 border-text-main/30 overflow-hidden bg-white" style={{ aspectRatio: '9/18', position: 'relative' }}>
            <div className="bg-black text-white text-[8px] flex items-center justify-between px-3 py-1">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <div className="w-5 h-2 rounded-sm border border-white/50 overflow-hidden">
                  <div className="h-full bg-accent-green rounded-sm" style={{ width: '75%' }} />
                </div>
                <span>75%</span>
              </div>
            </div>
            <div className="h-full bg-white p-2">
              {body && (
                <div className="bg-gray-100 rounded-lg rounded-tl-sm p-2 text-[8px] text-gray-700 max-w-[80%]">
                  {body}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EmailSnippetModal({ onClose }: { onClose: () => void }) {
  const [name, setName]       = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody]       = useState('');
  const [fromEmail, setFrom]  = useState('');
  const [toEmail, setTo]      = useState('');

  const richTools = [
    { icon: <span className="font-mono text-[10px] rotate-180 inline-block">↩</span> },
    { icon: <span className="font-mono text-[10px] inline-block">↪</span> },
    { icon: <Smile className="w-3 h-3" /> },
    { icon: <Tag className="w-3 h-3" /> },
    { icon: <Bold className="w-3 h-3" /> },
    { icon: <Italic className="w-3 h-3" /> },
    { icon: <Underline className="w-3 h-3" /> },
    { icon: <span className="text-[10px] font-bold">A</span> },
    { icon: <span className="text-[10px] font-bold underline decoration-wavy">A</span> },
    { icon: <List className="w-3 h-3" /> },
    { icon: <AlignLeft className="w-3 h-3" /> },
    { icon: <AlignCenter className="w-3 h-3" /> },
    { icon: <Strikethrough className="w-3 h-3" /> },
    { icon: <span className="font-mono text-[9px]">X²</span> },
    { icon: <span className="font-mono text-[9px]">X₂</span> },
    { icon: <Code className="w-3 h-3" /> },
    { icon: <span className="text-[9px]">❝</span> },
    { icon: <Image className="w-3 h-3" /> },
    { icon: <span className="text-[9px]">📎</span> },
    { icon: <Link2 className="w-3 h-3" /> },
    { icon: <span className="font-mono text-[9px]">&lt;/&gt;</span> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-surface border border-border rounded-2xl shadow-luxury w-full max-w-2xl overflow-hidden flex"
        onClick={e => e.stopPropagation()}
      >
        {/* Form side */}
        <div className="flex-1 flex flex-col">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-text-main">Create Email Snippet</h2>
              <p className="text-[11.5px] text-text-muted mt-0.5">Create and reuse email snippets for quick access via shortcuts. Save your go-to phrases and speed up your workflow.</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-hover transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 space-y-4 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-text-muted flex items-center gap-1">Name <span className="text-accent-red">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter Snippet Name"
                className="w-full px-3 py-2 bg-bg border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-text-muted flex items-center gap-1">Subject <span className="text-accent-red">*</span></label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Enter Subject"
                className="w-full px-3 py-2 bg-bg border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-text-muted flex items-center gap-1">Snippets Body <span className="text-accent-red">*</span></label>
              <div className="border border-border rounded-[8px] overflow-hidden bg-bg">
                {/* Rich text toolbar */}
                <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border/50">
                  {richTools.map((t, i) => (
                    <button key={i} className="p-1 rounded text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                      {t.icon}
                    </button>
                  ))}
                </div>
                {/* Secondary toolbar */}
                <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/50">
                  <select className="bg-transparent text-[11px] text-text-muted outline-none">
                    <option>Paragraph</option><option>Heading 1</option><option>Heading 2</option>
                  </select>
                  <select className="bg-transparent text-[11px] text-text-muted outline-none">
                    <option>14px</option><option>12px</option><option>16px</option><option>18px</option>
                  </select>
                  <select className="bg-transparent text-[11px] text-text-muted outline-none">
                    <option>1.5</option><option>1</option><option>2</option>
                  </select>
                </div>
                {/* Font */}
                <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/50">
                  <select className="bg-transparent text-[11px] text-text-muted outline-none">
                    <option>Inter</option><option>Arial</option><option>Georgia</option>
                  </select>
                </div>
                <textarea
                  value={body} onChange={e => setBody(e.target.value)}
                  placeholder="Type a message"
                  rows={5}
                  className="w-full px-3 py-2 bg-transparent text-[13px] text-text-main resize-none focus:outline-none placeholder:text-text-muted"
                />
                <div className="flex items-center justify-end px-3 py-1.5 border-t border-border/50 text-[11px] text-text-muted">
                  <span>{body.length} characters | {body.split(/\s+/).filter(Boolean).length} words</span>
                </div>
              </div>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-[8px] text-[12.5px] font-medium text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
              <Upload className="w-3.5 h-3.5" /> Add Attachment
            </button>
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-text-muted">Test Email Snippet</label>
              <div className="flex gap-2">
                <input value={fromEmail} onChange={e => setFrom(e.target.value)} placeholder="From Email Address"
                  className="flex-1 px-3 py-2 bg-bg border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted" />
                <input value={toEmail} onChange={e => setTo(e.target.value)} placeholder="To Email Address"
                  className="flex-1 px-3 py-2 bg-bg border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted" />
              </div>
              <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-[8px] text-[12.5px] font-medium text-text-muted hover:bg-surface-hover transition-colors mt-2">
                <Send className="w-3.5 h-3.5" /> Send Test
              </button>
            </div>
          </div>
          <div className="px-5 py-3.5 border-t border-border flex justify-end gap-3 bg-surface-hover/30">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-[8px] text-[13px] font-medium text-text-muted hover:bg-surface-hover transition-colors">Cancel</button>
            <button className="px-5 py-2 rounded-[8px] text-[13px] font-semibold text-bg hover:opacity-90 transition-all" style={{ backgroundColor: 'var(--primary)' }}>Save</button>
          </div>
        </div>

        {/* Phone preview */}
        <div className="w-44 border-l border-border bg-bg flex flex-col items-center py-5 px-2 shrink-0">
          <div className="w-full rounded-[22px] border-2 border-text-main/30 overflow-hidden bg-white" style={{ aspectRatio: '9/18', position: 'relative' }}>
            <div className="bg-black text-white text-[8px] flex items-center justify-between px-3 py-1">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <div className="w-5 h-2 rounded-sm border border-white/50 overflow-hidden">
                  <div className="h-full bg-accent-green rounded-sm" style={{ width: '75%' }} />
                </div>
                <span>75%</span>
              </div>
            </div>
            <div className="h-full bg-white p-2">
              {body && (
                <div className="space-y-1">
                  {subject && <p className="text-[7px] font-bold text-gray-800">{subject}</p>}
                  <p className="text-[7px] text-gray-600">{body}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ──────────────── Main Page ───────────────────────────────────

export default function SnippetsTab() {
  const [activeTab, setActiveTab]     = useState<'all' | 'folders'>('all');
  const [search, setSearch]           = useState('');
  const [newOpen, setNewOpen]         = useState(false);
  const [showText, setShowText]       = useState(false);
  const [showEmail, setShowEmail]     = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [rpOpen, setRpOpen]           = useState(false);

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* ── Page Header ── */}
      <div className="px-8 pt-6 pb-4 flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-[20px] font-bold text-text-main mb-1">Snippets</h1>
          <p className="text-[13px] text-text-muted">Create snippets to quickly insert predefined content into messages for faster, consistent communication.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-[8px] text-[13px] font-medium text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
            <FolderPlus className="w-4 h-4" /> New Folder
          </button>
          <div className="relative">
            <div className="flex rounded-[8px] overflow-hidden border border-border shadow-sm">
              <button
                onClick={() => { setShowText(true); setNewOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-[13px] font-semibold text-bg hover:opacity-90 transition-all"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <Plus className="w-4 h-4" /> New Snippet
              </button>
              <button
                onClick={() => setNewOpen(!newOpen)}
                className="px-2 py-2 text-bg border-l border-bg/20 hover:opacity-90 transition-all"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <AnimatePresence>
              {newOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNewOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute right-0 top-[calc(100%+6px)] w-[200px] bg-surface border border-border rounded-xl shadow-luxury overflow-hidden py-1 z-50"
                  >
                    <button
                      onClick={() => { setNewOpen(false); setShowText(true); }}
                      className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors flex items-center gap-2.5"
                    >
                      <MessageSquare className="w-4 h-4" /> Add Text Snippet
                    </button>
                    <button
                      onClick={() => { setNewOpen(false); setShowEmail(true); }}
                      className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors flex items-center gap-2.5"
                    >
                      <Mail className="w-4 h-4" /> Add Email Snippet
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="mx-8 mb-8 flex flex-col rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden">
        {/* Sub-tabs + search */}
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between bg-surface/60">
          <div className="flex items-center gap-1">
            {(['all', 'folders'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-1.5 rounded-full text-[12.5px] font-medium transition-colors ${
                  activeTab === t ? 'bg-primary/10 text-primary font-semibold' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {t === 'all' ? 'All Snippets' : 'Folders'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search"
              className="pl-8 pr-3 py-1.5 bg-bg border border-border rounded-[6px] text-[12.5px] text-text-main focus:outline-none focus:border-primary transition-all placeholder:text-text-muted w-[200px]"
            />
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-5 border-b border-border/50 bg-surface/80 backdrop-blur-md">
          <div className="p-3 flex items-center gap-2">
            <button className="w-4 h-4 border border-border rounded bg-bg hover:border-primary transition-colors" />
            <span className="text-[12px] font-semibold text-text-muted">Name</span>
          </div>
          <div className="p-3 text-[12px] font-semibold text-text-muted col-span-2">Body</div>
          <div className="p-3 text-[12px] font-semibold text-text-muted">Type</div>
          <div className="p-3 text-[12px] font-semibold text-text-muted">Date Updated</div>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(82,103,125,0.12)', border: '1px solid rgba(82,103,125,0.2)' }}>
            <Info className="w-6 h-6 text-primary" />
          </div>
          <p className="text-[13px] font-medium text-text-muted">No data available!</p>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-end gap-3 text-[12px] bg-surface/40">
          <span className="text-text-muted">Rows per page</span>
          <div className="relative">
            <button
              onClick={() => setRpOpen(!rpOpen)}
              className="flex items-center gap-1 px-2 py-1 border border-border rounded-[6px] text-text-main bg-bg hover:border-primary/50 transition-colors"
            >
              {rowsPerPage} <ChevronDown className="w-3 h-3" />
            </button>
            <AnimatePresence>
              {rpOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setRpOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute right-0 bottom-[calc(100%+4px)] w-[80px] bg-surface border border-border rounded-xl shadow-luxury overflow-hidden py-1 z-50"
                  >
                    {[10, 20, 50, 100].map(n => (
                      <button key={n} onClick={() => { setRowsPerPage(n); setRpOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-[12px] transition-colors ${rowsPerPage === n ? 'text-primary font-semibold' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'}`}>
                        {n}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <span className="text-text-muted">0 - 0 of 0</span>
          <button className="text-text-muted hover:text-text-main transition-colors font-medium">Previous</button>
          <button className="w-7 h-7 rounded-[6px] font-bold text-bg flex items-center justify-center text-[12px]" style={{ backgroundColor: 'var(--primary)' }}>1</button>
          <button className="text-text-muted hover:text-text-main transition-colors font-medium">Next</button>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showText  && <TextSnippetModal  onClose={() => setShowText(false)}  />}
        {showEmail && <EmailSnippetModal onClose={() => setShowEmail(false)} />}
      </AnimatePresence>
    </div>
  );
}
