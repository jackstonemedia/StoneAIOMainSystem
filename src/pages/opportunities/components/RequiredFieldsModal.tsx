import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, X, Check } from 'lucide-react';
import type { Opportunity, Stage, CustomField } from '../../../types/opportunities';

interface RequiredFieldsModalProps {
  isOpen: boolean;
  opportunity: Opportunity | null;
  targetStage: Stage | null;
  customFields?: CustomField[];
  onClose: () => void;
  onConfirm: (collectedValues: Record<string, any>) => void;
}

export function RequiredFieldsModal({
  isOpen,
  opportunity,
  targetStage,
  customFields = [],
  onClose,
  onConfirm,
}: RequiredFieldsModalProps) {
  if (!isOpen || !opportunity || !targetStage) return null;

  const requiredFields = parseJsonSafe<string[]>(targetStage.requiredFieldsJson, []);
  const [formValues, setFormValues] = useState<Record<string, any>>({
    amount: opportunity.amount || '',
    closeDate: opportunity.closeDate ? opportunity.closeDate.split('T')[0] : '',
    source: opportunity.source || '',
    ...opportunity.customFields,
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Verify all required fields are satisfied
    const missing: string[] = [];
    for (const rf of requiredFields) {
      if (rf === 'amount' && (!formValues.amount || parseFloat(formValues.amount) <= 0)) {
        missing.push('Value');
      } else if (rf === 'closeDate' && !formValues.closeDate) {
        missing.push('Expected Close Date');
      } else if (rf === 'source' && !formValues.source) {
        missing.push('Source');
      } else if (rf.startsWith('cf_')) {
        const key = rf.replace('cf_', '');
        const cfDef = customFields.find(f => f.id === key || f.label === key);
        if (!formValues[key] && !formValues[rf]) {
          missing.push(cfDef ? cfDef.label : key);
        }
      }
    }

    if (missing.length > 0) {
      setError(`Please fill in required fields: ${missing.join(', ')}`);
      return;
    }

    onConfirm(formValues);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-text-main">Required Stage Information</h2>
              <p className="text-[12px] text-text-muted">Moving to "{targetStage.name}" requires additional fields</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-[12px]">
              {error}
            </div>
          )}

          {requiredFields.map(rf => {
            if (rf === 'amount') {
              return (
                <div key={rf} className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-main">Estimated Value ($) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={formValues.amount || ''}
                    onChange={e => setFormValues(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              );
            }

            if (rf === 'closeDate') {
              return (
                <div key={rf} className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-main">Expected Close Date *</label>
                  <input
                    type="date"
                    value={formValues.closeDate || ''}
                    onChange={e => setFormValues(prev => ({ ...prev, closeDate: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              );
            }

            if (rf === 'source') {
              return (
                <div key={rf} className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-main">Lead Source *</label>
                  <select
                    value={formValues.source || ''}
                    onChange={e => setFormValues(prev => ({ ...prev, source: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
                    required
                  >
                    <option value="">Select source...</option>
                    <option value="Website Inbound">Website Inbound</option>
                    <option value="Cold Outreach">Cold Outreach</option>
                    <option value="Referral">Referral</option>
                    <option value="Organic Search">Organic Search</option>
                    <option value="Paid Ads">Paid Ads</option>
                    <option value="Event / Conference">Event / Conference</option>
                    <option value="Partner">Partner</option>
                  </select>
                </div>
              );
            }

            if (rf.startsWith('cf_')) {
              const cfId = rf.replace('cf_', '');
              const cfDef = customFields.find(f => f.id === cfId || f.label === cfId);
              if (!cfDef) return null;

              const options = cfDef.optionsJson ? parseJsonSafe<string[]>(cfDef.optionsJson, []) : [];

              return (
                <div key={rf} className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-main">{cfDef.label} *</label>
                  {cfDef.type === 'select' || cfDef.type === 'dropdown' ? (
                    <select
                      value={formValues[cfDef.id] || formValues[cfDef.label] || ''}
                      onChange={e => setFormValues(prev => ({ ...prev, [cfDef.id]: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
                      required
                    >
                      <option value="">Select option...</option>
                      {options.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={cfDef.type === 'number' || cfDef.type === 'currency' ? 'number' : 'text'}
                      placeholder={`Enter ${cfDef.label.toLowerCase()}...`}
                      value={formValues[cfDef.id] || ''}
                      onChange={e => setFormValues(prev => ({ ...prev, [cfDef.id]: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
                      required
                    />
                  )}
                </div>
              );
            }

            return null;
          })}
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
            className="px-5 py-2 rounded-xl text-[13px] font-semibold bg-primary hover:bg-primary-hover text-white flex items-center gap-2 shadow-sm transition-all"
          >
            <Check className="w-4 h-4" /> Save & Move Stage
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function parseJsonSafe<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}
