import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, XCircle, X, Check } from 'lucide-react';
import type { WonLostReason } from '../../../types/opportunities';

interface WonLostReasonModalProps {
  isOpen: boolean;
  type: 'won' | 'lost';
  reasons: WonLostReason[];
  opportunityTitle?: string;
  onClose: () => void;
  onConfirm: (data: { reason: string; notes?: string }) => void;
}

export function WonLostReasonModal({
  isOpen,
  type,
  reasons = [],
  opportunityTitle,
  onClose,
  onConfirm,
}: WonLostReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const filteredReasons = reasons.filter(r => r.type === type || r.type === 'both');
  const isWon = type === 'won';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({ reason: selectedReason, notes: notes.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isWon ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {isWon ? <Trophy className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-text-main">
                {isWon ? 'Mark as Won' : 'Mark as Lost'}
              </h2>
              {opportunityTitle && (
                <p className="text-[12px] text-text-muted truncate max-w-[260px]">{opportunityTitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-text-main">
              {isWon ? 'Why did we win this deal?' : 'Why was this deal lost?'}
            </label>
            {filteredReasons.length > 0 ? (
              <select
                value={selectedReason}
                onChange={e => setSelectedReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">Select a reason...</option>
                {filteredReasons.map(r => (
                  <option key={r.id} value={r.reason}>{r.reason}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder={isWon ? 'e.g. Great price, fast response' : 'e.g. Budget cut, competitor'}
                value={selectedReason}
                onChange={e => setSelectedReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-text-muted">Additional Context / Notes (Optional)</label>
            <textarea
              rows={3}
              placeholder="Any details or lessons learned..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-hover/30 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className={`px-5 py-2 rounded-xl text-[13px] font-semibold text-white flex items-center gap-2 shadow-sm transition-all ${
              isWon ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            <Check className="w-4 h-4" /> {isWon ? 'Confirm Won' : 'Confirm Lost'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
