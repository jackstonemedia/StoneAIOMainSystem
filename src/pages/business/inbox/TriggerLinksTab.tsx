import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, ChevronDown, Info, BarChart2, Link2, Copy, Trash2, X } from 'lucide-react';

interface TriggerLink {
  id: string;
  name: string;
  url: string;
  key: string;
  dateAdded: string;
}

function AddLinkModal({ onClose }: { onClose: () => void }) {
  const [name, setName]   = useState('');
  const [url, setUrl]     = useState('');
  const [linkKey, setKey] = useState('');

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
        className="bg-surface border border-border rounded-2xl shadow-luxury w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-[15px] font-bold text-text-main">Add Trigger Link</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-hover transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-text-muted flex items-center gap-1">Link Name <span className="text-accent-red">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter link name"
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all placeholder:text-text-muted" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-text-muted flex items-center gap-1">Link URL <span className="text-accent-red">*</span></label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com"
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all placeholder:text-text-muted" />
          </div>
          <div className="p-3 rounded-[8px] border border-border/50 bg-bg/50">
            <p className="text-[11.5px] text-text-muted">
              Trigger links allow you to embed trackable URLs in SMS/email messages. When clicked, they trigger automations and log the action on the contact timeline.
            </p>
          </div>
        </div>
        <div className="px-6 pb-5 flex items-center gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-[8px] text-[13px] font-medium text-text-muted hover:bg-surface-hover transition-colors">Cancel</button>
          <button
            className="px-5 py-2 rounded-[8px] text-[13px] font-semibold text-bg hover:opacity-90 transition-all"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Plus className="w-3.5 h-3.5 inline mr-1.5" />Add Link
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function TriggerLinksTab() {
  const [activeTab, setActiveTab]     = useState<'link' | 'analyze'>('link');
  const [search, setSearch]           = useState('');
  const [showAdd, setShowAdd]         = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [rpOpen, setRpOpen]           = useState(false);

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* ── Page Header ── */}
      <div className="px-8 pt-6 pb-4 flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-[20px] font-bold text-text-main mb-1">Trigger Links</h1>
          <p className="text-[13px] text-text-muted max-w-2xl">
            Trigger links allow you to put links inside SMS messages and emails, which allow you to track specific customer actions and trigger events based on when the link is clicked.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-semibold text-bg hover:opacity-90 transition-all whitespace-nowrap"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Plus className="w-4 h-4" /> Add Link
        </button>
      </div>

      {/* ── Table Card ── */}
      <div className="mx-8 mb-8 flex flex-col rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden">
        {/* Sub-tabs + search */}
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between bg-surface/60">
          <div className="flex items-center gap-1">
            {(['link', 'analyze'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-1.5 rounded-full text-[12.5px] font-medium transition-colors capitalize ${
                  activeTab === t ? 'bg-primary/10 text-primary font-semibold' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {t === 'link' ? 'Link' : 'Analyze'}
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

        {activeTab === 'link' ? (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-4 border-b border-border/50 bg-surface/80 backdrop-blur-md">
              {['Name', 'Link URL', 'Link Key', 'Date Added'].map(col => (
                <div key={col} className="p-3 text-[12px] font-semibold text-text-muted">{col}</div>
              ))}
            </div>

            {/* Empty State */}
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(82,103,125,0.12)', border: '1px solid rgba(82,103,125,0.2)' }}>
                <Info className="w-6 h-6 text-primary" />
              </div>
              <p className="text-[13px] font-medium text-text-muted">No links available</p>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-semibold text-bg hover:opacity-90 transition-all"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <Plus className="w-4 h-4" /> Add Link
              </button>
            </div>
          </>
        ) : (
          /* Analyze View */
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(82,103,125,0.12)', border: '1px solid rgba(82,103,125,0.2)' }}>
              <BarChart2 className="w-6 h-6 text-primary" />
            </div>
            <p className="text-[13px] font-medium text-text-muted">No analytics data yet</p>
            <p className="text-[12px] text-text-muted/70">Create trigger links and share them to start tracking clicks.</p>
          </div>
        )}

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

      {/* Modal */}
      <AnimatePresence>
        {showAdd && <AddLinkModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  );
}
