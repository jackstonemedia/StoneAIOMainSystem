import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, Clock, CheckCircle2, AlertTriangle,
  Play, RefreshCw, X, Check, Loader2,
  ExternalLink, MessageSquare, Mic, CalendarClock,
  AlertCircle
} from 'lucide-react';
import {
  assistantApi,
  type AssistantToolCall
} from '../../lib/api/assistant';

export default function AssistantActivityPage() {
  const navigate = useNavigate();

  const [toolCalls, setToolCalls] = useState<AssistantToolCall[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Execution states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Edit & Run modal state
  const [editingCall, setEditingCall] = useState<AssistantToolCall | null>(null);
  const [editArgsJson, setEditArgsJson] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Inspect detail modal state
  const [inspectCall, setInspectCall] = useState<AssistantToolCall | null>(null);

  // Toast feedback
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await assistantApi.listToolCalls({ limit: 100 });
      setToolCalls(data);
    } catch {
      showFeedback('Failed to load activity logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (id: string, customArgs?: Record<string, unknown>) => {
    setActionLoadingId(id);
    try {
      await assistantApi.approveToolCall(id, customArgs);
      showFeedback('Action approved and executed successfully.');
      if (editingCall?.id === id) setEditingCall(null);
      await loadData();
    } catch (err: any) {
      showFeedback(err?.response?.data?.error || 'Failed to approve action.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    try {
      await assistantApi.rejectToolCall(id);
      showFeedback('Action proposal rejected.');
      await loadData();
    } catch (err: any) {
      showFeedback(err?.response?.data?.error || 'Failed to reject action.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenEdit = (tc: AssistantToolCall) => {
    setEditingCall(tc);
    setEditArgsJson(JSON.stringify(tc.args, null, 2));
    setEditError(null);
  };

  const handleSaveAndRunEdit = () => {
    if (!editingCall) return;
    try {
      const parsed = JSON.parse(editArgsJson);
      handleApprove(editingCall.id, parsed);
    } catch {
      setEditError('Invalid JSON format. Please verify syntax before executing.');
    }
  };

  // Split pending vs audit history
  const pendingApprovals = useMemo(() => {
    return toolCalls.filter((tc) => tc.status === 'pending');
  }, [toolCalls]);

  const filteredHistory = useMemo(() => {
    return toolCalls.filter((tc) => {
      if (statusFilter !== 'all' && tc.status !== statusFilter) return false;
      if (sourceFilter !== 'all' && tc.source !== sourceFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const toolMatch = tc.toolName.toLowerCase().includes(q);
      const argsMatch = JSON.stringify(tc.args).toLowerCase().includes(q);
      return toolMatch || argsMatch;
    });
  }, [toolCalls, statusFilter, sourceFilter, searchQuery]);

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'voice':
        return <Mic className="w-3.5 h-3.5 text-primary" />;
      case 'scheduled':
        return <CalendarClock className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-text-muted" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Done</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            <span>Pending</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <X className="w-3 h-3" />
            <span>Rejected</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-500 border border-red-500/20">
            <AlertCircle className="w-3 h-3" />
            <span>Blocked</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-bg-secondary text-text-muted border border-border">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text-main flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-border/60 bg-bg-card/40 backdrop-blur sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/assistant')}
            className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-bg-secondary transition"
            aria-label="Back to Assistant"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Assistant Activity & Approvals</h1>
            <p className="text-xs text-text-muted">
              Governance log, pending execution gates, and full platform action history
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {feedback && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium animate-in fade-in ${
                feedback.type === 'error'
                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              }`}
            >
              {feedback.type === 'error' ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-bg-secondary transition"
            title="Refresh Activity"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-8">
        {/* Top Section: Pending Approvals (Spec Section 1.14) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-main">Pending Approvals</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-500">
                {pendingApprovals.length}
              </span>
            </div>
            <span className="text-xs text-text-muted">Review proposals before execution</span>
          </div>

          {loading ? (
            <div className="py-8 flex items-center justify-center text-text-muted gap-2 text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>Loading approvals...</span>
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="p-6 rounded-2xl bg-bg-card border border-border/80 flex items-center justify-center gap-3 text-text-muted">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="text-xs">No pending approvals. You're completely caught up!</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {pendingApprovals.map((call) => {
                const isWorking = actionLoadingId === call.id;

                return (
                  <div
                    key={call.id}
                    className="p-4 rounded-2xl bg-bg-card border border-amber-500/30 shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text-main font-mono">{call.toolName}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wide">
                            {call.risk}
                          </span>
                        </div>
                        <span className="text-[11px] text-text-muted flex items-center gap-1">
                          {getSourceIcon(call.source)}
                          <span>{new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-bg/80 border border-border/40 text-xs font-mono text-text-muted space-y-1 max-h-32 overflow-y-auto">
                        {Object.entries(call.args).map(([k, v]) => (
                          <div key={k} className="flex gap-1.5 truncate">
                            <span className="font-semibold text-text-main/80 shrink-0">{k}:</span>
                            <span className="truncate">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons: Approve, Edit, Discard (Spec Section 1.14) */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => handleReject(call.id)}
                        className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition"
                      >
                        Discard
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isWorking}
                          onClick={() => handleOpenEdit(call)}
                          className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-text-main hover:bg-bg-secondary transition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isWorking}
                          onClick={() => handleApprove(call.id)}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition shadow-xs disabled:opacity-50"
                        >
                          {isWorking ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          <span>Approve & Run</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Bottom Section: Activity Log Table (Spec Section 1.14) */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text-main">Activity Log</h2>
              <p className="text-xs text-text-muted">
                Audit trail of assistant executions, queries, and background actions
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-bg-card border border-border text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="done">Done</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="failed">Failed</option>
                <option value="blocked">Blocked</option>
              </select>

              {/* Source Filter */}
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-bg-card border border-border text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Sources</option>
                <option value="chat">Chat</option>
                <option value="voice">Voice</option>
                <option value="scheduled">Scheduled</option>
              </select>

              {/* Search filter */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by action..."
                className="px-3 py-1.5 rounded-xl bg-bg-card border border-border text-xs text-text-main placeholder:text-text-muted/60 focus:outline-none focus:ring-1 focus:ring-primary w-36 sm:w-44"
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-border/80 bg-bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg/80 border-b border-border/80 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Risk</th>
                    <th className="py-3 px-4 text-right">Conversation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-text-muted text-xs">
                        No activity records found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((call) => (
                      <tr
                        key={call.id}
                        onClick={() => setInspectCall(call)}
                        className="hover:bg-bg/60 transition cursor-pointer"
                      >
                        <td className="py-3 px-4 text-text-muted whitespace-nowrap">
                          {new Date(call.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4 capitalize">
                          <span className="flex items-center gap-1.5 text-text-main">
                            {getSourceIcon(call.source)}
                            <span>{call.source}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-text-main truncate max-w-xs">
                          {call.toolName}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(call.status)}
                        </td>
                        <td className="py-3 px-4 capitalize text-text-muted">
                          {call.risk}
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          {call.conversationId ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/assistant/c/${call.conversationId}`)}
                              className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium"
                            >
                              <span>Open chat</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-text-muted/60">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* Edit & Run Modal (Spec Section 1.14) */}
      {editingCall && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-bg-card border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-text-main">Edit Action Arguments</h3>
                <span className="text-[11px] font-mono text-text-muted">{editingCall.toolName}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingCall(null)}
                className="text-text-muted hover:text-text-main"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                Arguments (JSON)
              </label>
              <textarea
                rows={8}
                value={editArgsJson}
                onChange={(e) => {
                  setEditArgsJson(e.target.value);
                  setEditError(null);
                }}
                className="w-full px-3 py-2 rounded-xl bg-bg border border-border text-xs font-mono text-text-main focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
              />
              {editError && (
                <p className="text-[11px] text-rose-500">{editError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setEditingCall(null)}
                className="px-3.5 py-1.5 rounded-xl border border-border text-xs font-medium text-text-muted hover:text-text-main hover:bg-bg-secondary transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoadingId === editingCall.id}
                onClick={handleSaveAndRunEdit}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition shadow-xs disabled:opacity-50"
              >
                {actionLoadingId === editingCall.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>Save & Execute</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail / Inspection Modal */}
      {inspectCall && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-bg-card border border-border p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-text-main font-mono">{inspectCall.toolName}</h3>
                <span className="text-[11px] text-text-muted">
                  {new Date(inspectCall.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectCall(null)}
                className="text-text-muted hover:text-text-main"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-text-muted">Status: </span>
                  {getStatusBadge(inspectCall.status)}
                </div>
                <div>
                  <span className="text-text-muted">Source: </span>
                  <span className="font-medium capitalize text-text-main">{inspectCall.source}</span>
                </div>
                <div>
                  <span className="text-text-muted">Risk: </span>
                  <span className="font-medium capitalize text-text-main">{inspectCall.risk}</span>
                </div>
              </div>

              {/* Arguments */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  Parameters
                </span>
                <pre className="p-3 rounded-xl bg-bg border border-border/40 font-mono text-[11px] text-text-main whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(inspectCall.args, null, 2)}
                </pre>
              </div>

              {/* Result / Error */}
              {inspectCall.error && (
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-rose-500 uppercase tracking-wider">
                    Error Output
                  </span>
                  <pre className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 font-mono text-[11px] text-rose-500 whitespace-pre-wrap">
                    {inspectCall.error}
                  </pre>
                </div>
              )}

              {inspectCall.result !== undefined && (
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                    Execution Result
                  </span>
                  <pre className="p-3 rounded-xl bg-bg border border-border/40 font-mono text-[11px] text-text-main whitespace-pre-wrap overflow-x-auto max-h-48">
                    {JSON.stringify(inspectCall.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/60">
              {inspectCall.conversationId ? (
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/assistant/c/${inspectCall.conversationId}`);
                    setInspectCall(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <span>Go to chat thread</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setInspectCall(null)}
                className="px-3.5 py-1.5 rounded-xl bg-bg-secondary text-text-main text-xs font-medium hover:bg-bg-secondary/80 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
