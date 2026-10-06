import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, ChevronDown, Search, Check, CheckSquare, Square } from 'lucide-react';

type WorkflowFilter = string;

const DEMO_ASSIGNEES = ['All', 'Jack Stone', 'Casey Morgan', 'Taylor Reynolds'];
const DEMO_WORKFLOWS = ['All Workflows', 'Follow-up Sequence', 'Onboarding Flow', 'Re-engagement'];

export default function ManualActionsTab() {
  const [workflow, setWorkflow] = useState('Workflows');
  const [selectedWorkflow, setSelectedWorkflow] = useState('Select Workflow');
  const [selectedAssignee, setSelectedAssignee] = useState('Select Assignee');

  const [wfOpen, setWfOpen]   = useState(false);
  const [swOpen, setSwOpen]   = useState(false);
  const [asOpen, setAsOpen]   = useState(false);

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* ── Page Header ── */}
      <div className="px-8 pt-6 pb-4 flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-[20px] font-bold text-text-main mb-1">Manual Actions</h1>
          <p className="text-[13px] text-text-muted">Manual Actions are tasks that require you to manually place calls or send SMS messages to contacts.</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-semibold text-bg transition-all hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Play className="w-4 h-4" strokeWidth={1.5} fill="currentColor" />
          Let's Start
        </button>
      </div>

      {/* ── Table Card ── */}
      <div className="mx-8 mb-8 flex flex-col rounded-[10px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden">
        {/* Filter Row */}
        <div className="px-4 py-3 border-b border-border/50 flex items-center gap-3 bg-surface/60">
          {/* Workflow type picker */}
          <div className="relative">
            <button
              onClick={() => { setWfOpen(!wfOpen); setSwOpen(false); setAsOpen(false); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] border border-border bg-surface text-[12.5px] font-medium text-text-main hover:border-primary/50 transition-colors min-w-[130px]"
            >
              {workflow} <ChevronDown className="w-3.5 h-3.5 text-text-muted ml-auto" />
            </button>
            <AnimatePresence>
              {wfOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setWfOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute left-0 top-[calc(100%+4px)] w-[160px] bg-surface border border-border rounded-xl shadow-luxury overflow-hidden py-1 z-50"
                  >
                    {['Workflows', 'Campaigns'].map(opt => (
                      <button key={opt} onClick={() => { setWorkflow(opt); setWfOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-[12px] transition-colors ${workflow === opt ? 'text-primary font-semibold' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'}`}>
                        {opt}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Select Workflow */}
          <div className="relative">
            <button
              onClick={() => { setSwOpen(!swOpen); setWfOpen(false); setAsOpen(false); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] border border-border bg-surface text-[12.5px] font-medium text-text-muted hover:border-primary/50 transition-colors min-w-[180px]"
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              {selectedWorkflow}
              <ChevronDown className="w-3.5 h-3.5 ml-auto" />
            </button>
            <AnimatePresence>
              {swOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSwOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute left-0 top-[calc(100%+4px)] w-[220px] bg-surface border border-border rounded-xl shadow-luxury overflow-hidden py-1 z-50"
                  >
                    {DEMO_WORKFLOWS.map(opt => (
                      <button key={opt} onClick={() => { setSelectedWorkflow(opt); setSwOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-[12px] transition-colors flex items-center gap-2 ${selectedWorkflow === opt ? 'text-primary font-semibold' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'}`}>
                        {selectedWorkflow === opt && <Check className="w-3 h-3" />}
                        {opt}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Select Assignee */}
          <div className="relative">
            <button
              onClick={() => { setAsOpen(!asOpen); setWfOpen(false); setSwOpen(false); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] border border-border bg-surface text-[12.5px] font-medium text-text-muted hover:border-primary/50 transition-colors min-w-[160px]"
            >
              {selectedAssignee} <ChevronDown className="w-3.5 h-3.5 ml-auto" />
            </button>
            <AnimatePresence>
              {asOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAsOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute left-0 top-[calc(100%+4px)] w-[180px] bg-surface border border-border rounded-xl shadow-luxury overflow-hidden py-1 z-50"
                  >
                    {DEMO_ASSIGNEES.map(opt => (
                      <button key={opt} onClick={() => { setSelectedAssignee(opt); setAsOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-[12px] transition-colors ${selectedAssignee === opt ? 'text-primary font-semibold' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'}`}>
                        {opt}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-6 border-b border-border/50 bg-surface/80 backdrop-blur-md">
          <div className="p-3 flex items-center gap-2">
            <button className="w-4 h-4 border border-border rounded flex items-center justify-center bg-bg hover:border-primary transition-colors">
            </button>
            <span className="text-[12px] font-semibold text-text-muted">Contacts</span>
          </div>
          {['Workflow', 'Assigned To', 'Type', 'Status', 'Date Added'].map(col => (
            <div key={col} className="p-3 text-[12px] font-semibold text-text-muted">{col}</div>
          ))}
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Check className="w-7 h-7 text-accent-green" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-semibold text-text-main mb-1">Good Work!</p>
            <p className="text-[13px] text-text-muted">You have no pending tasks</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-end gap-3 text-[12px] bg-surface/40">
          <button className="text-text-muted hover:text-text-main transition-colors font-medium">Previous</button>
          <span className="text-text-muted">|</span>
          <button className="text-text-muted hover:text-text-main transition-colors font-medium">Next</button>
        </div>
      </div>
    </div>
  );
}
