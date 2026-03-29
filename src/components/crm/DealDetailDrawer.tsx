import { X, Calendar, Activity, CheckCircle2, MoreHorizontal, User, Building2, Tag, Edit2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface DealDetailDrawerProps {
  dealId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DealDetailDrawer({ dealId, isOpen, onClose }: DealDetailDrawerProps) {
  const { data: deal, isLoading } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: async () => {
      if (!dealId) return null;
      const res = await fetch(`/api/crm/deals/${dealId}`);
      if (!res.ok) throw new Error('Failed to fetch deal');
      return res.json();
    },
    enabled: !!dealId
  });

  const [activeTab, setActiveTab] = useState<'timeline' | 'tasks' | 'notes'>('timeline');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Drawer */}
      <div className="relative w-full max-w-2xl bg-surface h-full shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-300">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-bg/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl border border-primary/20 shadow-inner">
              {deal?.title ? deal.title.charAt(0).toUpperCase() : 'D'}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-text-main flex items-center gap-2">
                {isLoading ? <span className="w-32 h-6 bg-surface-hover animate-pulse rounded"></span> : deal?.title}
              </h2>
              <div className="text-sm font-medium text-text-muted mt-1 flex items-center gap-2">
                {isLoading ? (
                   <span className="w-24 h-4 bg-surface-hover animate-pulse rounded"></span>
                ) : (
                  <>
                    <span className="px-2 py-0.5 bg-surface border border-border rounded-md text-text-main">
                      {deal?.stage || 'No Stage'}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-primary">${deal?.amount?.toLocaleString() || '0'}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="p-2 text-text-muted hover:text-text-main rounded-lg hover:bg-surface-hover transition-colors shadow-sm bg-surface border border-border">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-text-muted hover:text-text-main rounded-lg hover:bg-surface-hover transition-colors shadow-sm bg-surface border border-border"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Bar (Mini) */}
        {!isLoading && deal && (
          <div className="px-6 py-4 border-b border-border flex items-center gap-3 bg-surface">
             <button className="flex-1 py-2 bg-primary/10 text-primary rounded-xl font-medium border border-primary/20 hover:bg-primary/20 transition-all text-sm flex items-center justify-center gap-2">
               <Edit2 className="w-4 h-4" /> Edit Deal
             </button>
             <button className="flex-1 py-2 bg-greenText/10 text-greenText font-medium rounded-xl border border-greenText/20 hover:bg-greenText/20 transition-all text-sm flex items-center justify-center gap-2">
               <CheckCircle2 className="w-4 h-4" /> Mark as Won
             </button>
          </div>
        )}

        {/* Main Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto w-full custom-scrollbar bg-bg/30">
          {isLoading ? (
             <div className="p-8 text-center text-text-muted flex flex-col items-center justify-center h-full">
               <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
               <p>Loading deal details...</p>
             </div>
          ) : deal ? (
            <div className="p-6 space-y-8">
              
              {/* Deal Meta Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface p-4 rounded-xl border border-border/60 shadow-sm flex flex-col gap-2">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-1"><User className="w-3 h-3"/> Contact</span>
                  <p className="font-semibold text-text-main text-sm">{deal.contactId ? 'Linked Contact' : 'No Contact Assigned'}</p>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-border/60 shadow-sm flex flex-col gap-2">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-1"><Building2 className="w-3 h-3"/> Company</span>
                  <p className="font-semibold text-text-main text-sm">{deal.company?.name || 'No Company Assigned'}</p>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-border/60 shadow-sm flex flex-col gap-2">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-1"><Calendar className="w-3 h-3"/> Expected Close</span>
                  <p className="font-semibold text-text-main text-sm">{deal.closeDate ? new Date(deal.closeDate).toLocaleDateString() : 'None Set'}</p>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-border/60 shadow-sm flex flex-col gap-2">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-1"><Tag className="w-3 h-3"/> Priority</span>
                  <p className="font-semibold text-text-main text-sm capitalize">{deal.description || 'Medium'}</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-border">
                <nav className="flex items-center gap-6" aria-label="Tabs">
                  {['timeline', 'tasks', 'notes'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`pb-3 text-sm font-semibold capitalize transition-colors relative ${
                        activeTab === tab 
                          ? 'text-primary' 
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      {tab}
                      {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-primary rounded-t-full" />
                      )}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="py-2">
                {activeTab === 'timeline' && (
                  <div className="space-y-6">
                    {/* Placeholder for Timeline */}
                    <div className="relative pl-6 border-l border-border/50 ml-3">
                      <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-primary/20 border border-primary flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </div>
                      <div className="-mt-1.5 bg-surface p-4 rounded-xl border border-border/50 shadow-sm">
                        <h4 className="font-medium text-sm">Deal Created</h4>
                        <p className="text-xs text-text-muted mt-1">{new Date(deal.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'tasks' && (
                  <div className="text-center py-8 text-text-muted border border-dashed border-border rounded-xl">
                    <p className="text-sm">No pending tasks for this deal.</p>
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className="text-center py-8 text-text-muted border border-dashed border-border rounded-xl">
                    <p className="text-sm">No notes available.</p>
                  </div>
                )}
              </div>
              
            </div>
          ) : (
            <div className="p-8 text-center text-red-500">Failed to load deal.</div>
          )}
        </div>
      </div>
    </div>
  );
}
