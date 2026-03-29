import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Building, Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContact } from '../../lib/api';

interface ContactSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactSlideOver({ isOpen, onClose }: ContactSlideOverProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    title: '',
    location: ''
  });

  const mutation = useMutation({
    mutationFn: createContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
      // Reset form
      setFormData({ firstName: '', lastName: '', email: '', phone: '', title: '', location: '' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName) return;
    mutation.mutate(formData);
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
                  <User className="w-5 h-5 text-primary" /> Create Contact
                </h2>
                <p className="text-xs text-text-muted mt-0.5">Add a new person to your CRM database.</p>
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
                
                {/* Name Group */}
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">First Name *</label>
                    <input 
                      required
                      value={formData.firstName}
                      onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                      type="text" 
                      placeholder="Jane"
                      className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder-text-muted/40"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Last Name</label>
                    <input 
                      value={formData.lastName}
                      onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                      type="text" 
                      placeholder="Doe"
                      className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder-text-muted/40"
                    />
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email Address
                    </label>
                    <input 
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      type="email" 
                      placeholder="jane.doe@example.com"
                      className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder-text-muted/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone Number
                    </label>
                    <input 
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      type="tel" 
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder-text-muted/40"
                    />
                  </div>
                </div>

                {/* Professional Info */}
                <div className="p-4 bg-bg border border-border/50 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-primary" /> Professional Details
                  </h3>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-muted flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> Job Title
                    </label>
                    <input 
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      type="text" 
                      placeholder="VP of Engineering"
                      className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder-text-muted/40"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-muted flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Location
                    </label>
                    <input 
                      value={formData.location}
                      onChange={e => setFormData({ ...formData, location: e.target.value })}
                      type="text" 
                      placeholder="San Francisco, CA"
                      className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder-text-muted/40"
                    />
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
                  {mutation.isPending ? 'Saving...' : 'Create Contact'}
                </button>
              </div>
            </form>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
