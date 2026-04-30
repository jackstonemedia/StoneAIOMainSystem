import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Star, AlertCircle, Filter, Search, Plus, Send, Bot, ExternalLink, RefreshCw, X, MessageSquare, ThumbsUp, Settings, Mail } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

function Stars({ rating, interactive = false, onChange }: { rating: number; interactive?: boolean; onChange?: (r: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({length:5}).map((_,i) => (
        <Star key={i}
          onClick={() => interactive && onChange?.(i+1)}
          className={`w-4 h-4 ${interactive ? 'cursor-pointer transition-transform hover:scale-110' : ''} ${i<rating ? 'text-amber-400 fill-amber-400' : 'text-border'}`} />
      ))}
    </div>
  );
}

const SOURCE_CONFIG: Record<string,{label:string;color:string;bg:string}> = {
  google:   {label:'Google',   color:'text-blue-400',  bg:'bg-blue-400/10 border-blue-400/20'},
  facebook: {label:'Facebook', color:'text-indigo-400', bg:'bg-indigo-400/10 border-indigo-400/20'},
  yelp:     {label:'Yelp',     color:'text-red-400',   bg:'bg-red-400/10 border-red-400/20'},
};

function timeAgo(iso: string) {
  const d = Math.floor((Date.now()-new Date(iso).getTime())/86400000);
  if (d===0) return 'Today'; if (d===1) return 'Yesterday'; return `${d}d ago`;
}

export default function Reputation() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all'|1|2|3|4|5>('all');
  const [search, setSearch] = useState('');
  const [replyOpen, setReplyOpen] = useState<string|null>(null);
  const [replyText, setReplyText] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState<string|null>(null);
  const [activeTab, setActiveTab] = useState<'requests' | 'inbox'>('requests');

  const { data: reviews = [], isLoading } = useQuery<any[]>({
    queryKey: ['reviews'],
    queryFn: () => fetch('/api/business/reviews').then(r => r.ok ? r.json() : []),
  });

  const sendRequest = useMutation({
    mutationFn: async (message: string) => {
      const r = await fetch('/api/business/reviews/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      toast('success', 'Review requests sent!', 'Sent to recent customers via SMS & Email');
      setRequestOpen(false);
    },
    onError: () => toast('error', 'Failed to send requests')
  });

  const replyMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const r = await fetch(`/api/business/reviews/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ replied: true, replyText: text }) });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      toast('success', 'Reply posted successfully');
      setReplyOpen(null);
      setReplyText('');
    },
    onError: () => toast('error', 'Failed to post reply')
  });

  const filtered = reviews.filter((r:any) => {
    const matchRating = filter === 'all' || r.rating === filter;
    const matchSearch = !search || r.author.toLowerCase().includes(search.toLowerCase()) || r.text.toLowerCase().includes(search.toLowerCase());
    return matchRating && matchSearch;
  });

  const total = reviews.length;
  const avg = total ? reviews.reduce((s:number,r:any)=>s+r.rating,0)/total : 0;
  const dist = [5,4,3,2,1].map(n=>({star:n,count:reviews.filter((r:any)=>r.rating===n).length}));
  const responded = reviews.filter((r:any)=>r.replied).length;

  const generateAIReply = (review: any) => {
    setAiLoading(review.id);
    const tones: Record<number,string> = {
      5: `Hi ${review.author.split(' ')[0]}, thank you so much for the 5-star review! We're thrilled to hear you had a great experience. Your support means the world to our team.`,
      4: `Hi ${review.author.split(' ')[0]}, thank you for the wonderful review and feedback! We are always striving to provide the best service possible. Let us know how we can earn that 5th star next time!`,
      3: `Hi ${review.author.split(' ')[0]}, thank you for taking the time to share your feedback. We'd love to learn more about your experience and how we can improve. Please send us a direct message.`,
      2: `Hi ${review.author.split(' ')[0]}, we are so sorry to hear that your experience did not meet expectations. This isn't the standard we hold ourselves to. Please contact us directly at support@stone.aio so we can make this right.`,
      1: `Dear ${review.author.split(' ')[0]}, we sincerely apologize for your experience. We take this very seriously and want to resolve the issue as quickly as possible. Please reach out to our management team immediately at support@stone.aio.`,
    };
    setTimeout(() => {
      setReplyText(tones[review.rating] || tones[3]);
      setAiLoading(null);
      setReplyOpen(review.id);
    }, 800);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
      {/* Header */}
      <div className="px-8 flex items-center justify-between bg-surface z-10 sticky top-0 shadow-sm relative border-b border-border h-[68px] shrink-0">
        <div>
          <h1 className="text-[20px] font-bold text-text-main">Reputation Management</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-border bg-surface hover:bg-surface-hover rounded-[8px] text-[13px] font-semibold text-text-main transition-colors shadow-sm">
            <Settings className="w-4 h-4" /> Preferences
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-sm" onClick={() => setActiveTab('requests')}>
            <Plus className="w-4 h-4" /> New Request
          </button>
        </div>
      </div>

      {/* Unified Toolbar / Tabs */}
      <div className="px-8 flex items-center gap-6 border-b border-border bg-surface relative shadow-[0_4px_24px_rgba(0,0,0,0.12)] h-[60px] shrink-0">
        {[
          { id: 'requests', label: 'Send Requests', Icon: Mail },
          { id: 'inbox', label: 'Review Inbox', Icon: Star }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'requests' | 'inbox')}
            className={`flex items-center gap-2 h-full border-b-[3px] transition-colors text-[13px] font-bold px-1 ${
              activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <tab.Icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {activeTab === 'requests' ? (
          <div className="max-w-[700px] mx-auto">
            <div className="bg-surface border border-border rounded-[12px] overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border bg-gradient-to-br from-surface to-surface-hover">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-[18px] font-bold text-text-main mb-2">Send Review Request</h2>
                <p className="text-[13px] text-text-muted">Invite your customers to share their experience. They will receive a targeted link to easily leave a 5-star review.</p>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider block mb-2">Customer Name</label>
                  <input type="text" className="w-full px-4 py-2.5 bg-bg border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary shadow-sm" placeholder="e.g. Jane Doe" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider block mb-2">Email Address</label>
                  <input type="email" className="w-full px-4 py-2.5 bg-bg border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary shadow-sm" placeholder="jane.doe@example.com" />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider block mb-2">Phone Number</label>
                  <input type="tel" className="w-full px-4 py-2.5 bg-bg border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary shadow-sm" placeholder="+1 (555) 123-4567" />
                </div>
                <div className="pt-2">
                  <button className="w-full py-3 bg-primary text-white rounded-[8px] text-[14px] font-bold shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:opacity-90 hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] transition-all flex items-center justify-center gap-2" onClick={() => toast('success', 'Review request queued for delivery')}>
                    <Send className="w-4 h-4" /> Send Request Now
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-[13px] font-bold text-text-main mb-4 uppercase tracking-wider">Recent Requests Overview</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-surface rounded-[8px] border border-border shadow-sm">
                  <div className="text-[24px] font-black text-text-main leading-none mb-1">142</div>
                  <div className="text-[11px] font-medium text-text-muted">Invites Sent (30d)</div>
                </div>
                <div className="p-4 bg-surface rounded-[8px] border border-border shadow-sm">
                  <div className="text-[24px] font-black text-primary leading-none mb-1">68%</div>
                  <div className="text-[11px] font-medium text-text-muted">Open Rate</div>
                </div>
                <div className="p-4 bg-surface rounded-[8px] border border-border shadow-sm">
                  <div className="text-[24px] font-black text-emerald-400 leading-none mb-1">29</div>
                  <div className="text-[11px] font-medium text-text-muted">New Reviews</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-[1000px] mx-auto space-y-6">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-5">
            {/* Average Rating */}
            <div className="col-span-1 bg-surface border border-border rounded-[12px] p-5 shadow-sm">
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4">Average Rating</div>
              <div className="text-[32px] font-bold text-text-main leading-none mb-3">{avg.toFixed(1)}</div>
              <Stars rating={Math.round(avg)} />
              <div className="text-[11px] text-text-muted mt-2">{total} total reviews</div>
            </div>

            {/* Distribution */}
            <div className="col-span-2 bg-surface border border-border rounded-[12px] p-5 shadow-sm">
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4">Rating Distribution</div>
              <div className="space-y-2.5">
                {dist.map(({star,count}) => (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-text-muted w-3">{star}</span>
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    <div className="flex-1 h-2 bg-bg border border-border rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: total ? `${(count/total)*100}%` : '0%' }} transition={{ duration: 0.8, delay: 0.1 }}
                        className="h-full bg-primary rounded-full relative overflow-hidden">
                        <div className="absolute inset-0 bg-white/20 w-1/2 -skew-x-12 translate-x-[-150%] animate-[shimmer_2s_infinite]" />
                      </motion.div>
                    </div>
                    <span className="text-[11px] font-semibold text-text-main w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Response Rate */}
            <div className="col-span-1 bg-surface border border-border rounded-[12px] p-5 shadow-sm flex flex-col">
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4">Response Rate</div>
              <div className="text-[32px] font-bold text-text-main leading-none mb-auto">{total ? Math.round((responded/total)*100) : 0}%</div>
              
              <div className="w-full h-2 bg-bg border border-border rounded-full overflow-hidden mt-2 mb-2">
                <motion.div initial={{ width: 0 }} animate={{ width: total ? `${(responded/total)*100}%` : '0%' }} transition={{ duration: 0.8 }}
                  className="h-full bg-emerald-400 rounded-full" />
              </div>
              <div className="text-[11px] text-text-muted">{responded} of {total} replied</div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex items-center justify-between bg-surface border border-border rounded-[12px] px-2 py-2">
            <div className="flex items-center gap-1">
              {(['all',5,4,3,2,1] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-[8px] text-[12px] font-bold transition-all ${filter===f ? 'bg-bg text-primary border border-border shadow-sm' : 'text-text-muted hover:text-text-main hover:bg-surface-hover border border-transparent'}`}>
                  {f === 'all' ? 'All Reviews' : <>{f} <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400"/></>}
                </button>
              ))}
            </div>
            <div className="relative w-[280px] pr-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search reviews..."
                className="w-full pl-9 pr-4 py-2 bg-bg border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted/60" />
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-surface border border-border rounded-[12px] p-6 h-[180px] animate-pulse">
                  <div className="flex gap-4 mb-4">
                    <div className="w-12 h-12 bg-surface-hover rounded-[10px]" />
                    <div className="space-y-2 flex-1"><div className="w-32 h-4 bg-surface-hover rounded" /><div className="w-24 h-3 bg-surface-hover rounded" /></div>
                  </div>
                  <div className="h-16 bg-surface-hover rounded w-3/4" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="bg-surface border border-dashed border-border rounded-[12px] py-20 flex flex-col items-center justify-center">
                <ThumbsUp className="w-10 h-10 text-border mb-3" />
                <p className="text-[15px] font-bold text-text-main mb-1">No reviews found</p>
                <p className="text-[13px] text-text-muted">Try adjusting your filters or request more reviews.</p>
              </div>
            ) : filtered.map((review: any) => {
              const src = SOURCE_CONFIG[review.source] || {label:review.source,color:'text-text-muted',bg:'bg-surface-hover border-border'};
              const initials = review.author.split(' ').map((n:string)=>n[0]).join('').substring(0,2).toUpperCase();
              const isOpen = replyOpen === review.id;
              
              return (
                <motion.div key={review.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-surface border border-border rounded-[12px] p-6 card-hover-lift">
                  <div className="flex items-start gap-5">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-bg to-surface border border-border flex items-center justify-center text-[15px] font-bold text-text-main shrink-0 shadow-sm">
                      {initials}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-4 mb-1">
                        <h3 className="text-[15px] font-bold text-text-main">{review.author}</h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[5px] border ${src.bg} ${src.color}`}>
                          {src.label}
                        </span>
                        <span className="text-[12px] text-text-muted ml-auto font-medium">{timeAgo(review.date)}</span>
                      </div>
                      
                      <div className="mb-3">
                        <Stars rating={review.rating} />
                      </div>
                      
                      <p className="text-[14px] text-text-muted leading-relaxed max-w-[90%]">"{review.text}"</p>

                      {/* Replied block */}
                      {review.replied && !isOpen && (
                        <div className="mt-4 p-4 bg-bg border border-border rounded-[8px] relative before:absolute before:left-[24px] before:top-[-6px] before:w-3 before:h-3 before:bg-bg before:border-t before:border-l before:border-border before:rotate-45">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-bold text-text-main">Your business replied</span>
                          </div>
                          <p className="text-[13px] text-text-muted">{review.replyText || "Thank you for your feedback!"}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border/50">
                        {!review.replied && (
                          <>
                            <button onClick={() => { setReplyOpen(isOpen ? null : review.id); if (!isOpen) setReplyText(''); }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-bold transition-all border ${isOpen ? 'bg-primary/10 text-primary border-primary/30' : 'bg-surface border-border text-text-muted hover:text-text-main hover:bg-surface-hover'}`}>
                              <MessageSquare className="w-3.5 h-3.5" />
                              {isOpen ? 'Cancel Reply' : 'Write Reply'}
                            </button>
                            <button onClick={() => generateAIReply(review)} disabled={aiLoading === review.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-primary/20 bg-primary/5 text-primary text-[12px] font-bold hover:bg-primary/10 transition-colors disabled:opacity-50">
                              {aiLoading === review.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                              {aiLoading === review.id ? 'Generating...' : 'AI Generate Reply'}
                            </button>
                          </>
                        )}
                        <a href={`https://${review.source}.com`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[12px] font-semibold text-text-muted hover:text-text-main ml-auto transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" /> View on {src.label}
                        </a>
                      </div>

                      {/* Reply Box */}
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="mt-4 relative">
                              <textarea
                                value={replyText} onChange={e => setReplyText(e.target.value)}
                                rows={4} placeholder="Type your response to the customer..."
                                className="w-full input-luxury resize-none"
                              />
                              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                                <button onClick={() => setReplyOpen(null)} className="px-3 py-1.5 rounded-[6px] text-[12px] font-bold text-text-muted hover:text-text-main transition-colors">Cancel</button>
                                <button onClick={() => replyMutation.mutate({ id: review.id, text: replyText })} disabled={replyMutation.isPending || !replyText.trim()}
                                  className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white rounded-[6px] text-[12px] font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                                  {replyMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                  Post Reply
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Request Modal */}
      <AnimatePresence>
        {requestOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRequestOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              className="relative z-10 bg-surface border border-border rounded-[16px] shadow-2xl w-[500px]">
              
              <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-surface-hover/20">
                <div>
                  <h2 className="text-[16px] font-bold text-text-main">Request Reviews</h2>
                  <p className="text-[12px] text-text-muted mt-0.5">Send a request to your 10 most recent customers</p>
                </div>
                <button onClick={() => setRequestOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">Message Template</label>
                <div className="bg-bg border border-border rounded-[8px] p-1 mb-4">
                  <textarea id="review-req-msg" rows={5} defaultValue={`Hi [Name],\n\nWe'd love to hear your feedback about Stone AIO. Would you mind leaving us a quick review?\n\nIt helps other businesses find us 🙏\n\nLeave a review: https://stone.aio/review`}
                    className="w-full bg-transparent border-none text-[13px] text-text-main focus:outline-none p-3 resize-none" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-surface-hover border border-border rounded-[8px] px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><MessageSquare className="w-4 h-4 text-primary" /></div>
                    <div><div className="text-[12px] font-bold text-text-main">SMS</div><div className="text-[10px] text-text-muted">High open rate</div></div>
                  </div>
                  <div className="flex-1 bg-surface-hover border border-border rounded-[8px] px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><Send className="w-4 h-4 text-primary" /></div>
                    <div><div className="text-[12px] font-bold text-text-main">Email</div><div className="text-[10px] text-text-muted">Click-through optimized</div></div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-border bg-surface-hover/20 flex justify-end gap-3 rounded-b-[16px]">
                <button className="px-4 py-2 border border-border rounded-[7px] text-[13px] font-bold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors" onClick={() => setRequestOpen(false)}>Cancel</button>
                <button className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-[7px] text-[13px] font-bold hover:opacity-90 transition-opacity"
                  disabled={sendRequest.isPending}
                  onClick={() => sendRequest.mutate((document.getElementById('review-req-msg') as HTMLTextAreaElement).value)}>
                  {sendRequest.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sendRequest.isPending ? 'Sending...' : 'Send Requests'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
