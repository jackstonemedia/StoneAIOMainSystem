import React, { useState } from 'react';
import { Mail, MessageSquare, Phone, FileText, Check, Loader2, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface QuickActionsBarProps {
  contactId: string;
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

export default function QuickActionsBar({ contactId, contactName, contactPhone, contactEmail }: QuickActionsBarProps) {
  const [activeAction, setActiveAction] = useState<'sms' | 'email' | 'note' | null>(null);
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState('');
  
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const type = activeAction;
      const endpoint = `/api/crm/actions/${type === 'note' ? 'notes' : type}`;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, contactId }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Request failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contactEvents', contactId] }); // If we have timeline queries
      closeAction();
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && activeAction !== 'email') return;
    
    let payload = {};
    if (activeAction === 'sms') {
      payload = { message: content };
    } else if (activeAction === 'email') {
      payload = { subject, body: content };
    } else if (activeAction === 'note') {
      payload = { note: content };
    }

    mutation.mutate(payload);
  };

  const closeAction = () => {
    setActiveAction(null);
    setContent('');
    setSubject('');
    mutation.reset();
  };

  // Glassmorphic styling classes
  const btnBase = "flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium transition-all shadow-sm";
  const btnActive = "bg-primary text-primary-foreground shadow-primary/25 border border-primary/20 scale-100 ring-2 ring-primary/20";
  const btnInactive = "bg-surface border border-border/60 hover:border-primary/40 hover:bg-surface-hover text-text-main hover:shadow-md active:scale-95";

  return (
    <div className="w-full">
      {/* Action Buttons Row */}
      <div className="flex flex-wrap items-center gap-3">
        <button 
          onClick={() => setActiveAction(activeAction === 'sms' ? null : 'sms')}
          className={`${btnBase} ${activeAction === 'sms' ? btnActive : btnInactive}`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>SMS Text</span>
        </button>

        <button 
          onClick={() => setActiveAction(activeAction === 'email' ? null : 'email')}
          className={`${btnBase} ${activeAction === 'email' ? btnActive : btnInactive}`}
        >
          <Mail className="w-4 h-4" />
          <span>Send Email</span>
        </button>

        <button 
          className={btnBase + " " + btnInactive}
          onClick={() => alert('Call feature via Retell AI loading...')}
        >
          <Phone className="w-4 h-4" />
          <span>One-Click Call</span>
        </button>

        <button 
          onClick={() => setActiveAction(activeAction === 'note' ? null : 'note')}
          className={`${btnBase} ${activeAction === 'note' ? btnActive : btnInactive}`}
        >
          <FileText className="w-4 h-4" />
          <span>Log Note</span>
        </button>
      </div>

      {/* Expandable Action Panel */}
      {activeAction && (
        <div className="mt-4 p-5 bg-surface rounded-2xl border border-border/80 shadow-xl shadow-black/5 relative overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300">
          
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary/50 to-transparent"></div>
          
          <button 
            onClick={closeAction}
            className="absolute top-4 right-4 p-1.5 text-text-muted hover:text-text-main rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
                {activeAction === 'sms' && <><MessageSquare className="w-5 h-5 text-blue-500" /> Send SMS to {contactName}</>}
                {activeAction === 'email' && <><Mail className="w-5 h-5 text-indigo-500" /> Send Email to {contactName}</>}
                {activeAction === 'note' && <><FileText className="w-5 h-5 text-amber-500" /> Log Note for {contactName}</>}
              </h3>
              
              {activeAction === 'sms' && !contactPhone && (
                <p className="text-red-500/80 text-sm mt-2 font-medium">⚠️ This contact does not have a phone number saved.</p>
              )}
              {activeAction === 'email' && !contactEmail && (
                <p className="text-red-500/80 text-sm mt-2 font-medium">⚠️ This contact does not have an email address saved.</p>
              )}
            </div>

            {activeAction === 'email' && (
              <input
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2.5 bg-bg/50 border border-border/60 rounded-xl focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-medium"
                required
              />
            )}

            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  activeAction === 'sms' ? "Type your text message..." :
                  activeAction === 'email' ? "Type your email message..." :
                  "What's on your mind?..."
                }
                rows={activeAction === 'email' ? 6 : 3}
                className="w-full p-4 bg-bg/50 border border-border/60 rounded-xl resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all text-[15px] custom-scrollbar"
                required
              />
            </div>

            {mutation.isError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm font-medium">
                {mutation.error.message}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={mutation.isPending || (activeAction === 'sms' && !contactPhone) || (activeAction === 'email' && !contactEmail)}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20"
              >
                {mutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                ) : (
                  <><Check className="w-4 h-4" /> {activeAction === 'note' ? 'Save Note' : 'Send Action'}</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
