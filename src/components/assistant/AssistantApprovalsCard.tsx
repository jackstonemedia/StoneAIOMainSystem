import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, Check, X, ExternalLink, Loader2, Sparkles, CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { assistantApi, type AssistantToolCall } from '../../lib/api/assistant';

export function AssistantApprovalsCard() {
  const navigate = useNavigate();
  const [pendingCalls, setPendingCalls] = useState<AssistantToolCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadPending = async () => {
    try {
      const list = await assistantApi.listToolCalls({ status: 'pending', limit: 5 });
      setPendingCalls(list);
    } catch (err) {
      console.error('[ApprovalsCard] Failed to load pending tool calls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
    const interval = setInterval(loadPending, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      await assistantApi.approveToolCall(id);
      await loadPending();
    } catch (err) {
      console.error('[ApprovalsCard] Approve failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    try {
      await assistantApi.rejectToolCall(id);
      await loadPending();
    } catch (err) {
      console.error('[ApprovalsCard] Reject failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-bg-card p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-main flex items-center gap-2">
              <span>Assistant Approvals</span>
              {pendingCalls.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-mono font-bold">
                  {pendingCalls.length}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Review and authorize high-risk actions requested by Stone AI
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/assistant')}
          className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
        >
          <span>Open Assistant</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="py-6 flex items-center justify-center text-text-muted gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Checking pending approvals...</span>
        </div>
      ) : pendingCalls.length === 0 ? (
        <div className="py-6 rounded-xl bg-bg-secondary/30 border border-border/40 flex flex-col items-center justify-center text-center p-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-500/80 mb-2" />
          <p className="text-xs font-medium text-text-main">All actions authorized</p>
          <p className="text-[11px] text-text-muted mt-0.5">
            No pending action approvals require your attention right now.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pendingCalls.map((call) => {
            const isLoadingThis = actionLoadingId === call.id;
            return (
              <div
                key={call.id}
                className="p-3 rounded-xl border border-border/60 bg-bg-secondary/40 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-text-main flex items-center gap-1.5 truncate">
                    <Sparkles className="w-3 h-3 text-primary shrink-0" />
                    <span className="capitalize">{call.toolName.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] uppercase font-mono px-1 rounded bg-amber-500/10 text-amber-500">
                      {call.risk}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-muted truncate mt-0.5 font-mono">
                    {JSON.stringify(call.args)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleReject(call.id)}
                    disabled={isLoadingThis}
                    className="p-1.5 rounded-lg border border-border/60 hover:bg-rose-500/10 text-text-muted hover:text-rose-500 transition-colors disabled:opacity-50"
                    title="Reject"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(call.id)}
                    disabled={isLoadingThis}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
                  >
                    {isLoadingThis ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    <span>Authorize</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
