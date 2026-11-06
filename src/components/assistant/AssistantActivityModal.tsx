import React, { useState, useEffect } from 'react';
import {
  X, ShieldCheck, Clock, CheckCircle2, AlertTriangle,
  Play, Filter, RefreshCw
} from 'lucide-react';
import { assistantApi, type AssistantToolCall } from '../../lib/api/assistant';

interface AssistantActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssistantActivityModal({ isOpen, onClose }: AssistantActivityModalProps) {
  const [activeTab, setActiveTab] = useState<'approvals' | 'audit'>('approvals');
  const [toolCalls, setToolCalls] = useState<AssistantToolCall[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadToolCalls = async () => {
    setIsLoading(true);
    try {
      const data = await assistantApi.listToolCalls({ limit: 100 });
      setToolCalls(data);
    } catch {
      // Ignore fetch error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadToolCalls();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const pendingApprovals = toolCalls.filter((tc) => tc.status === 'pending');
  const filteredAudit = toolCalls.filter((tc) => {
    if (statusFilter === 'all') return true;
    return tc.status === statusFilter;
  });

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      await assistantApi.approveToolCall(id);
      await loadToolCalls();
    } catch {
      // Handle error
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    try {
      await assistantApi.rejectToolCall(id);
      await loadToolCalls();
    } catch {
      // Handle error
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Assistant Activity & Approvals</h2>
              <p className="text-xs text-muted-foreground">Review pending actions and audit full tool execution history</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-border bg-muted/20 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeTab === 'approvals'
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Approvals</span>
              {pendingApprovals.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                  {pendingApprovals.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Execution Audit Log</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'audit' && (
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="done">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="rejected">Rejected</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            )}
            <button
              onClick={loadToolCalls}
              disabled={isLoading}
              title="Refresh"
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs">
          {activeTab === 'approvals' ? (
            pendingApprovals.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 opacity-80" />
                <p className="font-medium text-sm">No pending approvals</p>
                <p className="text-xs">Any actions requiring your confirmation will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.map((tc) => (
                  <div key={tc.id} className="p-4 rounded-xl border border-border bg-card/60 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm font-mono">{tc.toolName}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                          tc.risk === 'hardstop' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-muted text-muted-foreground'
                        }`}>
                          {tc.risk}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-[11px]">
                        {new Date(tc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 font-mono text-[11px] overflow-x-auto custom-scrollbar">
                      <pre>{JSON.stringify(tc.args, null, 2)}</pre>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleReject(tc.id)}
                        disabled={actionLoadingId === tc.id}
                        className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(tc.id)}
                        disabled={actionLoadingId === tc.id}
                        className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{actionLoadingId === tc.id ? 'Processing...' : 'Approve & Run'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredAudit.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <p>No actions matching the selected filter.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredAudit.map((tc) => (
                  <div key={tc.id} className="p-3.5 rounded-xl border border-border/60 bg-background/50 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground font-mono">{tc.toolName}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                          tc.status === 'done'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : tc.status === 'failed' || tc.status === 'blocked'
                            ? 'bg-rose-500/10 text-rose-500'
                            : tc.status === 'rejected'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {tc.status}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground truncate max-w-lg">
                        {JSON.stringify(tc.args)}
                      </div>
                      {tc.error && (
                        <div className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{tc.error}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {new Date(tc.createdAt).toLocaleDateString()} {new Date(tc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
