import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, ThumbsUp, AlertCircle, Filter, Search, Plus, Send, Bot, ExternalLink, Globe } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({length:5}).map((_,i)=>(
        <Star key={i} className={`w-3.5 h-3.5 ${i<rating?'text-amber-400 fill-amber-400':'text-border'}`} />
      ))}
    </div>
  );
}

const SOURCE_CONFIG: Record<string,{label:string;color:string;bg:string}> = {
  google:   {label:'Google',   color:'text-blue-400',   bg:'bg-blue-400/10'},
  facebook: {label:'Facebook', color:'text-indigo-400', bg:'bg-indigo-400/10'},
  yelp:     {label:'Yelp',     color:'text-red-400',    bg:'bg-red-400/10'},
};

function timeAgo(iso: string) {
  const d = Math.floor((Date.now()-new Date(iso).getTime())/86400000);
  if (d===0) return 'Today'; if (d===1) return 'Yesterday'; return `${d}d ago`;
}

export default function Reputation() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<'all'|1|2|3|4|5>('all');
  const [search, setSearch] = useState('');
  const [replyOpen, setReplyOpen] = useState<string|null>(null);
  const [replyText, setReplyText] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState<string|null>(null);

  const { data: reviews = [], isLoading } = useQuery<any[]>({
    queryKey: ['reviews'],
    queryFn: () => fetch('/api/business/reviews').then(r => r.ok ? r.json() : []),
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
      5: `Thank you so much, ${review.author.split(' ')[0]}! We're thrilled to hear this. Your support means the world to us. 🙏`,
      4: `Hi ${review.author.split(' ')[0]}, thank you for the kind words! We're always working to make the experience even better.`,
      3: `Thank you for your feedback, ${review.author.split(' ')[0]}. We'd love to make this right — please reach out to us directly.`,
      2: `We're sorry to hear about your experience, ${review.author.split(' ')[0]}. This isn't the standard we hold ourselves to. Please contact support@stone.aio and we'll make it right.`,
      1: `Hi ${review.author.split(' ')[0]}, we sincerely apologize for this experience. Please message us directly at support@stone.aio and our team will prioritize resolving this immediately.`,
    };
    setTimeout(() => {
      setReplyText(tones[review.rating] || tones[3]);
      setAiLoading(null);
      setReplyOpen(review.id);
      toast('success', 'AI reply generated');
    }, 1200);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Reputation"
        subtitle="Monitor and respond to customer reviews"
        breadcrumb={['Business','Reputation']}
        actions={
          <button className="btn-primary text-sm py-2 px-4" onClick={()=>setRequestOpen(true)}>
            <Plus className="w-4 h-4" /> Request Reviews
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4">
            {/* Average score */}
            <div className="card-surface p-5 col-span-1">
              <div className="text-label-caps text-text-muted mb-3">Average Rating</div>
              <div className="text-5xl font-bold text-text-main">{avg.toFixed(1)}</div>
              <Stars rating={Math.round(avg)} />
              <div className="text-xs text-text-muted mt-1">{total} total reviews</div>
            </div>

            {/* Distribution */}
            <div className="card-surface p-5 col-span-2">
              <div className="text-label-caps text-text-muted mb-3">Rating Distribution</div>
              <div className="space-y-2">
                {dist.map(({star,count}) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-muted w-4">{star}</span>
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                    <div className="flex-1 h-2 bg-border/40 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all duration-700" style={{width: total ? `${(count/total)*100}%` : '0%'}} />
                    </div>
                    <span className="text-xs text-text-muted w-4 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Response rate */}
            <div className="card-surface p-5">
              <div className="text-label-caps text-text-muted mb-3">Response Rate</div>
              <div className="text-4xl font-bold text-text-main mb-1">{total ? Math.round((responded/total)*100) : 0}%</div>
              <div className="text-xs text-text-muted">{responded} of {total} reviewed</div>
              <div className="mt-3 h-2 bg-border/40 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{width: total ? `${(responded/total)*100}%` : '0%'}} />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search reviews…"
                className="pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-text-main placeholder:text-text-muted/50 w-52" />
            </div>
            <div className="flex gap-2">
              {(['all',5,4,3,2,1] as const).map(f => (
                <button key={f} onClick={()=>setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filter===f?'bg-primary/10 text-primary border-primary/30':'border-border text-text-muted hover:border-primary/20 hover:text-text-main'}`}>
                  {f==='all'?'All':<span className="flex items-center gap-1">{f}<Star className="w-2.5 h-2.5 fill-current"/></span>}
                </button>
              ))}
            </div>
          </div>

          {/* Reviews */}
          <div className="space-y-4">
            {isLoading ? Array.from({length:4}).map((_,i)=>(
              <div key={i} className="card-surface p-5">
                <div className="flex gap-3 mb-3">
                  <div className="skeleton skeleton-avatar w-10 h-10" />
                  <div className="flex-1 space-y-2"><div className="skeleton skeleton-title w-32"/><div className="skeleton skeleton-text w-24"/></div>
                </div>
                <div className="skeleton h-12 rounded-lg"/>
              </div>
            )) : filtered.map((review:any) => {
              const src = SOURCE_CONFIG[review.source] || {label:review.source,color:'text-text-muted',bg:'bg-surface-hover'};
              const initials = review.author.split(' ').map((n:string)=>n[0]).join('').substring(0,2).toUpperCase();
              const isOpen = replyOpen === review.id;
              return (
                <div key={review.id} className="card-surface overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full border border-border bg-gradient-to-br from-primary/10 to-teal/10 flex items-center justify-center text-sm font-bold text-text-main shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-text-main">{review.author}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${src.bg} ${src.color}`}>
                              {src.label}
                            </span>
                            {review.replied && <span className="badge badge-success">Replied</span>}
                          </div>
                          <span className="text-xs text-text-muted shrink-0">{timeAgo(review.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 mb-3">
                          <Stars rating={review.rating} />
                        </div>
                        <p className="text-sm text-text-muted leading-relaxed">{review.text}</p>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-4">
                          <button
                            onClick={() => { setReplyOpen(isOpen?null:review.id); if(!isOpen) setReplyText(''); }}
                            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${isOpen?'bg-primary/10 text-primary border-primary/30':'border-border text-text-muted hover:border-primary/20 hover:text-primary'}`}
                          >
                            <Send className="w-3 h-3" /> {isOpen ? 'Cancel' : 'Reply'}
                          </button>
                          <button
                            onClick={() => generateAIReply(review)}
                            disabled={aiLoading === review.id}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-purple-400/20 text-purple-400 bg-purple-400/5 hover:bg-purple-400/10 transition-all disabled:opacity-50"
                          >
                            <Bot className="w-3 h-3" />
                            {aiLoading === review.id ? 'Generating…' : 'AI Reply'}
                          </button>
                          <a href={`https://${review.source}.com`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-main ml-auto transition-colors">
                            <ExternalLink className="w-3 h-3" /> View original
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Reply box */}
                    {isOpen && (
                      <div className="mt-4 ml-14 animate-scale-in">
                        <textarea
                          value={replyText}
                          onChange={e=>setReplyText(e.target.value)}
                          rows={3}
                          placeholder="Write your reply…"
                          className="w-full input-luxury resize-none"
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button className="btn-secondary text-xs py-2 px-4" onClick={()=>{setReplyOpen(null);setReplyText('');}}>Cancel</button>
                          <button onClick={()=>{toast('success','Reply sent');setReplyOpen(null);setReplyText('');}} className="btn-primary text-xs py-2 px-4">
                            <Send className="w-3 h-3" /> Send Reply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Request Review Modal */}
      {requestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={()=>setRequestOpen(false)}/>
          <div className="relative bg-surface border border-border rounded-2xl p-8 w-[480px] shadow-[var(--shadow-luxury)] animate-scale-in">
            <h3 className="font-bold text-lg mb-1">Request Reviews</h3>
            <p className="text-sm text-text-muted mb-6">Send a review request via SMS or Email to your recent customers.</p>
            <textarea rows={4} defaultValue="Hi [Name], we'd love to hear your feedback about Stone AIO. Would you mind leaving us a quick review? It helps other businesses find us 🙏 — [Your Business]. Leave a review: https://stone.aio/review"
              className="input-luxury resize-none mb-4" />
            <div className="flex justify-end gap-3">
              <button className="btn-secondary text-sm py-2 px-4" onClick={()=>setRequestOpen(false)}>Cancel</button>
              <button className="btn-primary text-sm py-2 px-4" onClick={()=>{toast('success','Review requests sent!','Sent to 142 recent customers');setRequestOpen(false);}}>
                <Send className="w-4 h-4"/> Send to Recent Customers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
