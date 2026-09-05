import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Filter, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import ConversationListPane, { FilterPopover, SORT_OPTIONS } from './components/ConversationListPane';
import ThreadPane from './components/ThreadPane';
import { useConversationsCtx } from './context/ConversationsContext';
import { conversationsApi } from '../../lib/api/conversations';
import { queryKeys } from '../../lib/queryKeys';

export default function ConversationsInbox() {
  const { id } = useParams<{ id?: string }>();
  const {
    selectedId, setSelectedId,
    sort, setSort,
    activeFilterCount,
    queryFilters,
  } = useConversationsCtx();

  // Bottom bar dropdown states
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [pageSizeDropdownOpen, setPageSizeDropdownOpen] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Open thread when navigating to /conversations/:id directly
  useEffect(() => {
    if (id && id !== selectedId) {
      setSelectedId(id);
    }
  }, [id, selectedId, setSelectedId]);

  // Query total conversations for pagination controls
  const { data: conversations = [] } = useQuery({
    queryKey: [...queryKeys.conversations.list(), queryFilters],
    queryFn: () => conversationsApi.list(queryFilters),
    staleTime: 15_000,
  });

  const totalConversations = conversations.length;
  const totalPages = Math.max(1, Math.ceil(totalConversations / pageSize));

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden z-0">
      {/* ── Main Split View inside Disconnected Frosted Glass Panel ── */}
      <div className="flex-1 overflow-hidden mx-8 mt-6 mb-6 rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 relative z-10 flex">
        <ConversationListPane />
        <ThreadPane />
      </div>

      {/* ── Full-width Sticky Bottom Bar matching CRM Sections ──────── */}
      <div
        className="px-8 py-4 border-t flex items-center justify-between text-[13px] shrink-0 z-20 sticky bottom-0 shadow-[0_-4px_16px_rgba(0,0,0,0.1)]"
        style={{
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
          color: 'var(--sidebar-text-main)',
          '--text-main': '#ffffff',
          '--text-muted': '#94a3b8',
          '--border': 'rgba(255,255,255,0.15)',
          '--surface': 'rgba(255,255,255,0.1)',
          '--surface-hover': 'rgba(255,255,255,0.16)',
          '--bg': 'var(--sidebar-bg)',
          '--btn-bg': 'var(--primary)',
          '--btn-hover': 'var(--primary-hover)',
          '--btn-text': '#ffffff',
          '--btn-border': 'transparent',
        } as React.CSSProperties}
      >
        {/* Left: Advanced filters + Sort */}
        <div className="flex items-center gap-2">
          {/* Advanced filters */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => {
                setShowFilter(p => !p);
                setShowSort(false);
              }}
              className={`btn-secondary ${activeFilterCount > 0 ? 'border-primary/50 text-primary' : ''}`}
            >
              <Filter className="w-4 h-4 text-white" /> Advanced filters
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center ml-1">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showFilter && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFilter(false)} />
                  <div className="absolute left-0 bottom-full mb-2 z-50">
                    <FilterPopover onClose={() => setShowFilter(false)} placement="top" />
                  </div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Sort */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => {
                setShowSort(p => !p);
                setShowFilter(false);
              }}
              className="btn-secondary"
            >
              <ChevronDown className="w-4 h-4" /> Sort
            </button>

            <AnimatePresence>
              {showSort && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSort(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute left-0 bottom-full mb-2 w-[200px] bg-surface border border-border shadow-luxury rounded-xl overflow-hidden py-1 z-50 ring-1 ring-white/5"
                  >
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSort(opt.value);
                          setShowSort(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2 text-[13px] font-medium transition-colors ${
                          sort === opt.value
                            ? 'text-primary font-bold bg-primary/10'
                            : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {sort === opt.value && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Rows per page & Pagination Controls matching CRM */}
        <div className="flex items-center gap-4">
          {/* Rows per page selector */}
          <div className="relative">
            <button
              onClick={() => setPageSizeDropdownOpen(!pageSizeDropdownOpen)}
              className="flex items-center gap-1.5 border border-border rounded-lg px-2.5 py-1.5 cursor-pointer font-semibold hover:border-primary/50 transition-colors bg-bg text-text-main text-[12px]"
              title="Rows per page"
            >
              <span>{pageSize} / page</span>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            </button>

            {pageSizeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setPageSizeDropdownOpen(false)} />
                <div className="absolute bottom-full mb-1 right-0 w-32 bg-surface border border-border rounded-lg shadow-xl py-1 z-30">
                  {[10, 20, 30, 50].map(sz => (
                    <button
                      key={sz}
                      onClick={() => {
                        setPageSize(sz);
                        setPage(1);
                        setPageSizeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] flex items-center justify-between transition-colors ${
                        pageSize === sz ? 'bg-primary/10 text-primary font-bold' : 'text-text-main hover:bg-surface-hover'
                      }`}
                    >
                      <span>{sz} convs</span>
                      {pageSize === sz && <Check className="w-3.5 h-3.5 text-primary" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Page Navigation */}
          <div className="flex items-center gap-1.5 font-semibold">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-[6px] border border-border text-text-muted hover:text-text-main hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[12px]"
            >
              Prev
            </button>
            <button className="min-w-[28px] h-7 px-2 flex items-center justify-center rounded-[6px] text-[12px] font-bold bg-primary text-white shadow-xs">
              {page}
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-[6px] border border-border text-text-muted hover:text-text-main hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[12px]"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
