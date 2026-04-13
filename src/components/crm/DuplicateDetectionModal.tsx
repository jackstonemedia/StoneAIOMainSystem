import React, { useState } from 'react';
import { X, Merge, AlertTriangle, Check, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DuplicateContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  priority: string;
  status: string;
  leadScore: number;
  tags: { label: string; color?: string }[];
  lastActivity: string;
}

interface DuplicateDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: DuplicateContact;
  duplicates: DuplicateContact[];
  onMerge: (keepId: string, removeId: string, merged: Partial<DuplicateContact>) => void;
}

type FieldKey = 'firstName' | 'lastName' | 'email' | 'phone' | 'company';
const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company' },
];

export default function DuplicateDetectionModal({ isOpen, onClose, contact, duplicates, onMerge }: DuplicateDetectionModalProps) {
  const [selectedDup, setSelectedDup] = useState<DuplicateContact>(duplicates[0] || contact);
  const [fieldChoices, setFieldChoices] = useState<Record<FieldKey, 'left' | 'right'>>({
    firstName: 'left', lastName: 'left', email: 'left', phone: 'left', company: 'left',
  });
  const [merging, setMerging] = useState(false);
  const [done, setDone] = useState(false);

  const toggleChoice = (key: FieldKey) => {
    setFieldChoices(prev => ({ ...prev, [key]: prev[key] === 'left' ? 'right' : 'left' }));
  };

  const handleMerge = () => {
    setMerging(true);
    const merged: Partial<DuplicateContact> = {};
    FIELDS.forEach(({ key }) => {
      merged[key] = fieldChoices[key] === 'left' ? contact[key] as string : selectedDup[key] as string;
    });
    setTimeout(() => {
      onMerge(contact.id, selectedDup.id, merged);
      setMerging(false);
      setDone(true);
      setTimeout(() => { setDone(false); onClose(); }, 1200);
    }, 600);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-6">
            <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-[720px] flex flex-col max-h-[90vh] overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-text-muted0" />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-bold text-text-main">Duplicate Detected</h2>
                    <p className="text-[12px] text-text-muted0 mt-0.5">{duplicates.length} potential duplicate{duplicates.length > 1 ? 's' : ''} found. Choose fields to keep.</p>
                  </div>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-hover transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Duplicate selector if multiple */}
              {duplicates.length > 1 && (
                <div className="px-6 pt-4 flex gap-2 overflow-x-auto">
                  {duplicates.map(dup => (
                    <button key={dup.id} onClick={() => setSelectedDup(dup)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${selectedDup.id === dup.id ? 'bg-[#52677D] text-white border-[#52677D]' : 'bg-surface-hover text-text-main border-border hover:border-border'}`}>
                      {dup.firstName} {dup.lastName}
                    </button>
                  ))}
                </div>
              )}

              {/* Merge fields */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_48px_1fr] gap-3 mb-3">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider text-center">Current Record</div>
                  <div />
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider text-center">Duplicate</div>
                </div>

                <div className="space-y-2">
                  {FIELDS.map(({ key, label }) => {
                    const leftVal = contact[key] as string;
                    const rightVal = selectedDup[key] as string;
                    const choice = fieldChoices[key];
                    return (
                      <div key={key} className="grid grid-cols-[1fr_48px_1fr] gap-3 items-center">
                        {/* Left */}
                        <div onClick={() => toggleChoice(key)}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${choice === 'left' ? 'border-[#52677D] bg-[#52677D]' : 'border-border bg-surface-hover hover:border-border opacity-60'}`}>
                          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">{label}</div>
                          <div className="text-[13px] font-semibold text-text-main truncate">{leftVal || '—'}</div>
                          {choice === 'left' && <Check className="w-3.5 h-3.5 text-[#52677D] float-right -mt-3" />}
                        </div>

                        {/* Toggle */}
                        <div className="flex items-center justify-center">
                          <button onClick={() => toggleChoice(key)}
                            className="w-8 h-8 rounded-full bg-surface-hover hover:bg-surface-hover flex items-center justify-center text-text-muted0 transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Right */}
                        <div onClick={() => toggleChoice(key)}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${choice === 'right' ? 'border-[#52677D] bg-[#52677D]' : 'border-border bg-surface-hover hover:border-border opacity-60'}`}>
                          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">{label}</div>
                          <div className="text-[13px] font-semibold text-text-main truncate">{rightVal || '—'}</div>
                          {choice === 'right' && <Check className="w-3.5 h-3.5 text-[#52677D] float-right -mt-3" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-text-muted mt-4 text-center">Click a field to select which value to keep. The other record will be deleted.</p>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-surface-hover/50">
                <button onClick={onClose} className="px-5 py-2 rounded-xl text-[13px] font-semibold text-text-muted0 hover:bg-surface-hover transition-colors">Cancel</button>
                <button onClick={handleMerge} disabled={merging || done}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl text-[13px] font-semibold bg-[#52677D] text-white hover:bg-[#52677D] transition-colors shadow-sm disabled:opacity-60">
                  {done ? <><Check className="w-4 h-4" /> Merged!</> : merging ? 'Merging...' : <><Merge className="w-4 h-4" /> Merge Records</>}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
