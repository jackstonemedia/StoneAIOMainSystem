import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, Send, CheckCircle2 } from 'lucide-react';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: string;
  amount: number;
}

export function InvoiceModal({ isOpen, onClose, dealId, amount }: InvoiceModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleIssue = async () => {
    setLoading(true);
    try {
      // Phase 3 Stripe Intent API Call
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, dealId })
      });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to issue invoice');
      }

      setSuccess(true);
      setLoading(false);
      setTimeout(() => onClose(), 2000);
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Error communicating with billing server');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-hover/20">
              <div>
                <h3 className="text-[16px] font-bold text-text-main">Issue Invoice</h3>
                <p className="text-[12px] text-text-muted mt-0.5">Automated billing via Stripe</p>
              </div>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6">
              {success ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="w-16 h-16 bg-emerald-400/10 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h4 className="text-[16px] font-bold text-text-main mb-1">Invoice Sent</h4>
                  <p className="text-[13px] text-text-muted">The client will receive an email shortly.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="bg-bg border border-border rounded-[8px] p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Amount Due</div>
                      <div className="text-[20px] font-bold text-text-main">${amount.toLocaleString()}</div>
                    </div>
                  </div>
                  
                  <div className="text-[13px] text-text-muted leading-relaxed">
                    By issuing this invoice, Stripe will generate a secure checkout link and automatically send it to the primary contact's email address.
                  </div>
                </div>
              )}
            </div>

            {!success && (
              <div className="px-6 py-4 bg-surface-hover/50 border-t border-border flex items-center justify-end gap-3">
                <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-text-muted hover:text-text-main border border-transparent hover:border-border transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleIssue} disabled={loading} className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-[13px] font-bold shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] transition-all disabled:opacity-50">
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                  {loading ? "Issuing..." : "Confirm & Send"}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
