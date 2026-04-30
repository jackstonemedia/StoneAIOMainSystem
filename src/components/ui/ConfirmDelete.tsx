import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmDeleteProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  isLoading?: boolean;
}

export function ConfirmDelete({ isOpen, onClose, onConfirm, title = "Confirm Deletion", message = "Are you sure you want to delete this item? This action cannot be undone.", isLoading = false }: ConfirmDeleteProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden z-10">
            <div className="p-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-red-400/10 border border-red-400/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-text-main mb-1">{title}</h3>
                  <p className="text-[13px] text-text-muted leading-relaxed">{message}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-surface-hover/50 border-t border-border flex items-center justify-end gap-3">
              <button onClick={onClose} disabled={isLoading} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-text-muted hover:text-text-main border border-transparent hover:border-border transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={onConfirm} disabled={isLoading} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[13px] font-bold shadow-sm transition-colors disabled:opacity-50">
                {isLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
