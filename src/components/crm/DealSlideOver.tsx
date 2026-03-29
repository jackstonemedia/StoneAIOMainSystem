import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Target, DollarSign, Calendar, BarChart, Bell } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDeal } from '../../lib/api';

interface DealSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DealSlideOver({ isOpen, onClose }: DealSlideOverProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    stage: 'lead',
    priority: 'medium',
    closeDate: '' // Will coerce to DateTime on server
  });

  const mutation = useMutation({
    mutationFn: createDeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
      // Reset form
      setFormData({ title: '', amount: '', stage: 'lead', priority: 'medium', closeDate: '' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;
    mutation.mutate({
      ...formData,
      amount: parseFloat(formData.amount) || 0
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-40"
          />

          {/* Slide Over */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-[450px] bg-surface border-l border-border/60 shadow-2xl z-50 flex flex-col font-sans"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-bg/50 backdrop-blur-md">
              <div>
                <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" /> Create Deal
                </h2>
                <p className="text-xs text-text-muted mt-0.5">Add a new opportunity to your sales pipeline.</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-surface-hover text-text-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Opportunity Title *</label>
                  <input 
                    required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    type="text" 
                    placeholder="Q4 Enterprise Retainer"
                    className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder-text-muted/40"
                  />
                </div>

                <div className="flex gap-4">
                  {/* Amount */}
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-semibold">$</span>
                      <input 
                        value={formData.amount}
                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                        type="number" 
                        placeholder="10,000"
                        className="w-full pl-7 pr-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder-text-muted/40"
                      />
                    </div>
                  </div>

                  {/* Close Date */}
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Expected Close
                    </label>
                    <input 
                      value={formData.closeDate}
                      onChange={e => setFormData({ ...formData, closeDate: e.target.value })}
                      type="date" 
                      className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder-text-muted/40 text-text-main"
                    />
                  </div>
                </div>

                {/* Pipeline Logic */}
                <div className="p-4 bg-bg border border-border/50 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                    <BarChart className="w-3.5 h-3.5 text-primary" /> Pipeline Settings
                  </h3>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-muted flex items-center gap-1">
                      Stage
                    </label>
                    <select 
                      value={formData.stage}
                      onChange={e => setFormData({ ...formData, stage: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all text-text-main"
                    >
                      <option value="lead">Lead</option>
                      <option value="qualified">Qualified</option>
                      <option value="proposal">Proposal</option>
                      <option value="negotiation">Negotiation</option>
                      <option value="won">Won</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-muted flex items-center gap-1">
                      <Bell className="w-3 h-3" /> Priority
                    </label>
                    <div className="flex gap-2">
                       {['low', 'medium', 'high'].map(p => (
                         <button 
                           key={p}
                           type="button"
                           onClick={() => setFormData({ ...formData, priority: p })}
                           className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg border transition-all ${
                             formData.priority === p 
                               ? 'border-primary bg-primary/10 text-primary'
                               : 'border-border/60 bg-surface text-text-muted hover:border-border'
                           }`}
                         >
                           {p}
                         </button>
                       ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-border/50 bg-bg/50 flex items-center justify-end gap-3 backdrop-blur-md">
                <button 
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-text-muted hover:text-text-main hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={mutation.isPending}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {mutation.isPending ? 'Saving...' : 'Create Deal'}
                </button>
              </div>
            </form>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
