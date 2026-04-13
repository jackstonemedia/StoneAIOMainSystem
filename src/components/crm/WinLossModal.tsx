import React, { useState } from 'react';
import { X, TrendingDown, TrendingUp, Check, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WinLossModalProps {
  isOpen: boolean;
  onClose: () => void;
  outcome: 'won' | 'lost';
  dealTitle: string;
  onConfirm: (reason: string, note: string) => void;
}

const WIN_REASONS = ['Price was right', 'Product fit', 'Strong relationship', 'Better support', 'Referral', 'Demo convinced them', 'Trial success', 'Other'];
const LOSS_REASONS = ['Price too high', 'Chose a competitor', 'No budget', 'No decision made', 'Missing feature', 'Poor timing', 'Lost contact', 'Other'];

export default function WinLossModal({ isOpen, onClose, outcome, dealTitle, onConfirm }: WinLossModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const reasons = outcome === 'won' ? WIN_REASONS : LOSS_REASONS;
  const isWon = outcome === 'won';

  const handleConfirm = () => {
    if (!selectedReason) return;
    setSaving(true);
    setTimeout(() => {
      onConfirm(selectedReason, note);
      setSelectedReason(''); setNote(''); setSaving(false);
    }, 400);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-6">
            <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-[460px]">
              <div className="p-6 pb-5 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex items-center gap-3 px-4 py-2 rounded-xl ${isWon ? 'bg-green-50' : 'bg-red-50'}`}>
                    {isWon ? <TrendingUp className="w-5 h-5 text-green-500" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
                    <span className={`text-[14px] font-bold ${isWon ? 'text-green-700' : 'text-red-700'}`}>
                      Deal {isWon ? 'Won' : 'Lost'}
                    </span>
                  </div>
                  <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[13px] text-text-main">
                  <span className="font-semibold text-text-main">"{dealTitle}"</span> — What was the {isWon ? 'winning' : 'primary'} reason?
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {reasons.map(reason => (
                    <button key={reason} onClick={() => setSelectedReason(reason)}
                      className={`text-left p-3 rounded-xl text-[12px] font-semibold border-2 transition-all ${selectedReason === reason
                        ? isWon ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-700'
                        : 'border-border text-text-main hover:border-border hover:bg-surface-hover'}`}>
                      {selectedReason === reason && <Check className="w-3 h-3 inline mr-1.5 -mt-0.5" />}
                      {reason}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">
                    <MessageSquare className="w-3.5 h-3.5" /> Notes (optional)
                  </label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Add context or next steps..."
                    className="w-full px-3.5 py-2.5 bg-surface-hover border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:ring-2 focus:ring-[#52677D]/30 resize-none placeholder:text-text-muted" />
                </div>
              </div>

              <div className="px-6 pb-5 flex justify-end gap-3">
                <button onClick={onClose} className="px-5 py-2 rounded-xl text-[13px] font-semibold text-text-muted0 hover:bg-surface-hover transition-colors">Skip</button>
                <button onClick={handleConfirm} disabled={!selectedReason || saving}
                  className={`px-6 py-2 rounded-xl text-[13px] font-semibold text-white transition-colors shadow-sm disabled:opacity-40 ${isWon ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
                  {saving ? 'Saving...' : `Mark as ${isWon ? 'Won' : 'Lost'}`}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
