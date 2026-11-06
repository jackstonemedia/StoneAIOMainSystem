import React, { useState } from 'react';
import {
  ShieldAlert, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight,
  Play, Trash2, Edit3, Lock, Eye, Sparkles
} from 'lucide-react';
import { assistantApi } from '../../lib/api/assistant';

export interface ActionCardProps {
  cardType: 'proposal' | 'needs_approval' | 'lookup' | 'mode_prompt' | 'blocked' | 'no_permission';
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  reason?: string;
  requiredRole?: string;
  currentRole?: string;
  onModeSelected?: (mode: string) => void;
  onActionComplete?: () => void;
}

export function ActionCard({
  cardType,
  toolCallId,
  toolName = 'action',
  args = {},
  result,
  reason,
  requiredRole,
  currentRole,
  onModeSelected,
  onActionComplete,
}: ActionCardProps) {
  const [isExpanded, setIsExpanded] = useState(cardType !== 'lookup');
  const [isEditing, setIsEditing] = useState(false);
  const [editedArgs, setEditedArgs] = useState(JSON.stringify(args, null, 2));
  const [status, setStatus] = useState<'idle' | 'approving' | 'rejecting' | 'approved' | 'rejected'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!toolCallId) return;
    setStatus('approving');
    setErrorMessage(null);
    try {
      let finalArgs: Record<string, unknown> | undefined = undefined;
      if (isEditing) {
        try {
          finalArgs = JSON.parse(editedArgs);
        } catch {
          setErrorMessage('Invalid JSON arguments format');
          setStatus('idle');
          return;
        }
      }

      await assistantApi.approveToolCall(toolCallId, finalArgs);
      setStatus('approved');
      if (onActionComplete) onActionComplete();
    } catch (err: unknown) {
      setStatus('idle');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to approve action');
    }
  };

  const handleReject = async () => {
    if (!toolCallId) return;
    setStatus('rejecting');
    setErrorMessage(null);
    try {
      await assistantApi.rejectToolCall(toolCallId);
      setStatus('rejected');
      if (onActionComplete) onActionComplete();
    } catch (err: unknown) {
      setStatus('idle');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reject action');
    }
  };

  // 1. Mode Prompt Card
  if (cardType === 'mode_prompt') {
    return (
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 space-y-3 text-sm">
        <div className="flex items-center gap-2 text-indigo-400 font-medium">
          <Sparkles className="h-4 w-4" />
          <span>Choose an Access Mode to Proceed</span>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          The assistant attempted to run <strong>{toolName}</strong>. Select how much autonomy you want to grant Stone AI in this conversation:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            onClick={() => onModeSelected?.('read_only')}
            className="flex flex-col items-start p-2.5 rounded-lg border border-border/60 bg-background/50 hover:bg-muted text-left transition"
          >
            <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
              <Eye className="h-3.5 w-3.5 text-blue-400" /> Read-only
            </div>
            <span className="text-[11px] text-muted-foreground mt-1">Queries & reads data only</span>
          </button>
          <button
            onClick={() => onModeSelected?.('draft')}
            className="flex flex-col items-start p-2.5 rounded-lg border border-border/60 bg-background/50 hover:bg-muted text-left transition"
          >
            <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
              <Edit3 className="h-3.5 w-3.5 text-amber-400" /> Draft mode
            </div>
            <span className="text-[11px] text-muted-foreground mt-1">Proposes changes before executing</span>
          </button>
          <button
            onClick={() => onModeSelected?.('full')}
            className="flex flex-col items-start p-2.5 rounded-lg border border-border/60 bg-background/50 hover:bg-muted text-left transition"
          >
            <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
              <Play className="h-3.5 w-3.5 text-emerald-400" /> Full autonomy
            </div>
            <span className="text-[11px] text-muted-foreground mt-1">Runs actions automatically</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Blocked Card
  if (cardType === 'blocked') {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs space-y-1.5">
        <div className="flex items-center gap-2 text-destructive font-medium">
          <Lock className="h-4 w-4" />
          <span>Action Blocked: {toolName}</span>
        </div>
        <p className="text-muted-foreground">{reason || 'This action is not permitted in Read-only mode.'}</p>
      </div>
    );
  }

  // 3. No Permission Card
  if (cardType === 'no_permission') {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3.5 text-xs space-y-1.5">
        <div className="flex items-center gap-2 text-rose-400 font-medium">
          <ShieldAlert className="h-4 w-4" />
          <span>Permission Denied: {toolName}</span>
        </div>
        <p className="text-muted-foreground">
          This action requires the <strong>{requiredRole}</strong> role. Your current role is <strong>{currentRole || 'member'}</strong>.
        </p>
      </div>
    );
  }

  // 4. Lookup Card (Read operation summary)
  if (cardType === 'lookup') {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/20 text-xs overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-muted/30 transition text-left"
        >
          <div className="flex items-center gap-2 font-mono text-muted-foreground">
            <Eye className="h-3.5 w-3.5 text-blue-400" />
            <span className="font-semibold text-foreground">{toolName}</span>
          </div>
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>

        {isExpanded && (
          <div className="px-3.5 py-2.5 border-t border-border/40 bg-background/50 space-y-2">
            <div>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Parameters:</span>
              <pre className="mt-1 p-2 bg-muted/40 rounded text-[11px] overflow-x-auto custom-scrollbar font-mono">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
            {result !== undefined && (
              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Result:</span>
                <pre className="mt-1 p-2 bg-muted/40 rounded text-[11px] overflow-x-auto custom-scrollbar font-mono">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 5. Proposal or Needs Approval Card
  const isHighRisk = cardType === 'needs_approval';

  if (status === 'approved') {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>Action approved and executed: <strong>{toolName}</strong></span>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 text-xs flex items-center justify-between text-muted-foreground">
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4" />
          <span>Action discarded: <strong>{toolName}</strong></span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 text-xs transition ${
        isHighRisk
          ? 'border-amber-500/40 bg-amber-950/15'
          : 'border-border/80 bg-card/60'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          {isHighRisk ? (
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary" />
          )}
          <span className="text-sm font-semibold text-foreground">
            {isHighRisk ? 'Needs Your Approval' : 'Proposed Action'}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-muted text-muted-foreground">
            {toolName}
          </span>
        </div>
        {reason && (
          <span className="text-[11px] text-amber-400 font-medium">{reason}</span>
        )}
      </div>

      {/* Arguments preview or editor */}
      {isEditing ? (
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Edit Parameters (JSON):</label>
          <textarea
            value={editedArgs}
            onChange={(e) => setEditedArgs(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      ) : (
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground">Parameters:</span>
          <div className="p-2.5 bg-background/60 rounded-lg border border-border/40 font-mono text-[11px] overflow-x-auto custom-scrollbar">
            {Object.entries(args).map(([key, val]) => (
              <div key={key} className="flex gap-2 py-0.5">
                <span className="text-muted-foreground font-semibold">{key}:</span>
                <span className="text-foreground">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="text-[11px] text-destructive flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-2 py-1 rounded text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1 transition"
          >
            <Edit3 className="h-3 w-3" />
            <span>{isEditing ? 'Cancel Edit' : 'Edit'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReject}
            disabled={status !== 'idle'}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Discard</span>
          </button>
          <button
            onClick={handleApprove}
            disabled={status !== 'idle'}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 ${
              isHighRisk
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{status === 'approving' ? 'Executing...' : 'Approve'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
