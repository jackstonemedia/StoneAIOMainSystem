/**
 * Reputation Management — Stone AIO
 *
 * v1-lite:
 * 1. Review request campaigns (send SMS/email to contacts)
 * 2. Reviews dashboard (aggregated Google + Facebook reviews)
 * 3. Respond to reviews inline
 * 4. Embed widget snippet generator
 *
 * API layer:
 *   GET  /business/reputation/reviews
 *   GET  /business/reputation/stats
 *   POST /business/reputation/request
 *   POST /business/reputation/reviews/:id/reply
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Star, Send, MessageSquare, ThumbsUp, Globe, Mail, Phone,
  RefreshCw, Plus, Copy, Check, Search, Filter, ChevronDown,
  TrendingUp, AlertCircle, ExternalLink, User, Code2, X
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import { SlideOverPanel } from '../../components/ui/SlideOverPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Review {
  id: string;
  platform: 'google' | 'facebook' | 'manual';
  authorName: string;
  authorAvatar?: string;
  rating: number;        // 1–5
  body: string;
  date: string;          // ISO
  reply?: string;
  replyAt?: string;
  url?: string;
}

interface ReputationStats {
  avgRating: number;
  totalReviews: number;
  googleAvg?: number;
  facebookAvg?: number;
  distribution: { stars: number; count: number }[];
  recentTrend: 'up' | 'down' | 'flat';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StarRow({ rating, size = 4 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          className={`w-${size} h-${size} ${s <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-border'}`}
        />
      ))}
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string; border: string }> = {
    google:   { label: 'Google',   color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/20' },
    facebook: { label: 'Facebook', color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400/20' },
    manual:   { label: 'Manual',   color: 'text-text-muted', bg: 'bg-surface-hover',  border: 'border-border/50' },
  };
  const c = cfg[platform] || cfg.manual;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.bg} ${c.border} ${c.color}`}>
      {c.label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReputationPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterReplied, setFilterReplied] = useState<'all' | 'replied' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [requestPanelOpen, setRequestPanelOpen] = useState(false);
  const [widgetCopied, setWidgetCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'reviews' | 'request' | 'widget'>('reviews');

  // Request campaign form
  const [reqForm, setReqForm] = useState({
    channel: 'sms' as 'sms' | 'email',
    message: "Hi {first_name}! We'd love to hear about your experience with us. Would you mind leaving us a quick review? {review_link}",
    segmentFilter: 'recent_customers',
    estimatedCount: 0,
  });

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: stats, isLoading: statsLoading } = useQuery<ReputationStats>({
    queryKey: ['reputation', 'stats'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/business/reputation/stats');
        return data;
      } catch {
        // Return graceful fallback when API isn't wired yet
        return {
          avgRating: 4.3,
          totalReviews: 0,
          googleAvg: undefined,
          facebookAvg: undefined,
          distribution: [
            { stars: 5, count: 0 },
            { stars: 4, count: 0 },
            { stars: 3, count: 0 },
            { stars: 2, count: 0 },
            { stars: 1, count: 0 },
          ],
          recentTrend: 'flat' as const,
        };
      }
    },
    staleTime: 60000,
  });

  const { data: reviews = [], isLoading: reviewsLoading, refetch } = useQuery<Review[]>({
    queryKey: ['reputation', 'reviews'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/business/reputation/reviews');
        return data || [];
      } catch {
        return [];
      }
    },
    staleTime: 30000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────

  const replyMutation = useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      const { data } = await apiClient.post(`/business/reputation/reviews/${id}/reply`, { reply });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reputation', 'reviews'] });
      toast('success', 'Reply posted', 'Your response has been submitted.');
      setReplyTarget(null);
      setReplyText('');
    },
    onError: (err: any) => toast('error', 'Reply failed', err?.response?.data?.error || err?.message),
  });

  const requestMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/business/reputation/request', payload);
      return data;
    },
    onSuccess: (data) => {
      toast('success', 'Review request sent!', `Sent to ${data?.sent || 0} contacts.`);
      setRequestPanelOpen(false);
    },
    onError: (err: any) => toast('error', 'Send failed', err?.response?.data?.error || err?.message),
  });

  // ── Filtered reviews ──────────────────────────────────────────────────────

  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      if (filterRating && r.rating !== filterRating) return false;
      if (filterPlatform !== 'all' && r.platform !== filterPlatform) return false;
      if (filterReplied === 'replied' && !r.reply) return false;
      if (filterReplied === 'pending' && r.reply) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return r.authorName.toLowerCase().includes(q) || r.body.toLowerCase().includes(q);
      }
      return true;
    });
  }, [reviews, filterRating, filterPlatform, filterReplied, searchQuery]);

  const pendingReplies = reviews.filter(r => !r.reply).length;
  const avgRating = stats?.avgRating ?? 0;

  // Widget embed snippet
  const widgetSnippet = `<script src="https://cdn.stoneaio.com/widget/reviews.js" data-workspace-id="YOUR_WORKSPACE_ID" data-theme="dark"></script>`;

  const handleCopyWidget = () => {
    navigator.clipboard?.writeText(widgetSnippet);
    setWidgetCopied(true);
    setTimeout(() => setWidgetCopied(false), 2000);
    toast('success', 'Snippet copied!', "Paste into your website's <head> or before </body>.");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full w-full bg-bg text-text-main relative overflow-hidden">
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* ── Header ── */}
      <div className="h-[60px] px-6 border-b border-border/60 flex items-center justify-between shrink-0 bg-surface/60 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-sm shrink-0">
            <Star className="w-4 h-4 fill-white" />
          </div>
          <div>
            <span className="text-[15px] font-black text-text-main tracking-tight">Reputation</span>
            <p className="text-[11px] text-text-muted">Review management & monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover border border-border/50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${reviewsLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setRequestPanelOpen(true)}
            className="btn-primary text-[12px]"
          >
            <Send className="w-3.5 h-3.5" /> Request Reviews
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-4 border-b border-border/40 shrink-0">
        {[
          {
            label: 'Avg Rating',
            value: avgRating > 0 ? avgRating.toFixed(1) : '—',
            sub: `${stats?.totalReviews || 0} reviews`,
            color: 'text-amber-400',
            icon: Star,
          },
          {
            label: 'Google',
            value: stats?.googleAvg ? stats.googleAvg.toFixed(1) : '—',
            sub: 'Google rating',
            color: 'text-blue-400',
            icon: Globe,
          },
          {
            label: 'Facebook',
            value: stats?.facebookAvg ? stats.facebookAvg.toFixed(1) : '—',
            sub: 'Facebook rating',
            color: 'text-indigo-400',
            icon: ThumbsUp,
          },
          {
            label: 'Awaiting Reply',
            value: pendingReplies,
            sub: pendingReplies > 0 ? 'needs attention' : 'all caught up',
            color: pendingReplies > 0 ? 'text-amber-400' : 'text-emerald-400',
            icon: MessageSquare,
          },
        ].map((k, i) => (
          <div key={i} className="p-3 border-r border-border/40 last:border-r-0 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-surface-hover`}>
              <k.icon className={`w-4 h-4 ${k.color}`} />
            </div>
            <div>
              <div className={`text-[22px] font-black leading-none ${k.color}`}>{k.value}</div>
              <div className="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-0.5">{k.label}</div>
              <div className="text-[10px] text-text-muted">{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-border/40 bg-surface/30 shrink-0">
        {[
          { id: 'reviews', label: `Reviews (${reviews.length})` },
          { id: 'request', label: 'Request Reviews' },
          { id: 'widget', label: 'Embed Widget' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ══ Reviews Tab ══ */}
        {activeTab === 'reviews' && (
          <div className="p-6 space-y-4">
            {/* Rating distribution + search/filter bar */}
            <div className="grid grid-cols-3 gap-4">
              {/* Distribution */}
              <div className="col-span-1 bg-surface/60 border border-border/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`text-[36px] font-black leading-none ${avgRating >= 4 ? 'text-amber-400' : avgRating >= 3 ? 'text-amber-400/70' : 'text-red-400'}`}>
                    {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                  </div>
                  <div>
                    <StarRow rating={avgRating} size={4} />
                    <p className="text-[11px] text-text-muted mt-0.5">{stats?.totalReviews || 0} total reviews</p>
                  </div>
                </div>
                {(stats?.distribution || []).sort((a, b) => b.stars - a.stars).map(d => {
                  const total = Math.max(stats?.totalReviews || 1, 1);
                  const pct = Math.round((d.count / total) * 100);
                  return (
                    <button
                      key={d.stars}
                      onClick={() => setFilterRating(filterRating === d.stars ? null : d.stars)}
                      className={`w-full flex items-center gap-2 group transition-all ${filterRating === d.stars ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                    >
                      <div className="flex items-center gap-1 shrink-0 w-16 text-[11px] font-bold text-text-muted">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {d.stars}
                      </div>
                      <div className="flex-1 h-1.5 bg-border/50 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          className={`h-full rounded-full ${filterRating === d.stars ? 'bg-amber-400' : 'bg-amber-400/50'}`}
                        />
                      </div>
                      <span className="text-[10px] text-text-muted shrink-0 w-8 text-right">{d.count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search + filter */}
              <div className="col-span-2 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search reviews..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-surface-hover border border-border/50 rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
                    />
                  </div>
                  <select
                    value={filterPlatform}
                    onChange={e => setFilterPlatform(e.target.value)}
                    className="bg-surface-hover border border-border/50 text-[12px] font-bold rounded-xl px-3 py-2.5 text-text-main focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Platforms</option>
                    <option value="google">Google</option>
                    <option value="facebook">Facebook</option>
                    <option value="manual">Manual</option>
                  </select>
                  <select
                    value={filterReplied}
                    onChange={e => setFilterReplied(e.target.value as any)}
                    className="bg-surface-hover border border-border/50 text-[12px] font-bold rounded-xl px-3 py-2.5 text-text-main focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Reviews</option>
                    <option value="pending">Needs Reply</option>
                    <option value="replied">Replied</option>
                  </select>
                </div>

                {/* Active filters */}
                {(filterRating || filterPlatform !== 'all' || filterReplied !== 'all') && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-text-muted">Filters:</span>
                    {filterRating && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-400/10 border border-amber-400/20 rounded-full text-[11px] font-bold text-amber-400">
                        {filterRating} stars <button onClick={() => setFilterRating(null)} className="ml-1"><X className="w-3 h-3" /></button>
                      </span>
                    )}
                    {filterPlatform !== 'all' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-400/10 border border-blue-400/20 rounded-full text-[11px] font-bold text-blue-400 capitalize">
                        {filterPlatform} <button onClick={() => setFilterPlatform('all')} className="ml-1"><X className="w-3 h-3" /></button>
                      </span>
                    )}
                    {filterReplied !== 'all' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-surface-hover border border-border/50 rounded-full text-[11px] font-bold text-text-muted">
                        {filterReplied} <button onClick={() => setFilterReplied('all')} className="ml-1"><X className="w-3 h-3" /></button>
                      </span>
                    )}
                    <button onClick={() => { setFilterRating(null); setFilterPlatform('all'); setFilterReplied('all'); setSearchQuery(''); }}
                      className="text-[11px] text-primary hover:underline">Clear all</button>
                  </div>
                )}
              </div>
            </div>

            {/* Reviews list */}
            {reviewsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-surface/60 border border-border/50 rounded-2xl p-5 animate-pulse">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-hover" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-surface-hover rounded w-32" />
                        <div className="h-3 bg-surface-hover rounded w-24" />
                        <div className="h-3 bg-surface-hover rounded w-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-border/50 rounded-2xl bg-surface/20">
                <Star className="w-10 h-10 text-text-muted/20 mx-auto mb-3" />
                <p className="text-[15px] font-bold text-text-main mb-1">
                  {reviews.length === 0 ? 'No reviews yet' : 'No reviews match your filters'}
                </p>
                <p className="text-[13px] text-text-muted mb-4">
                  {reviews.length === 0
                    ? 'Connect your Google Business and Facebook profiles in Settings, or send your first review request.'
                    : 'Try adjusting or clearing your filters.'}
                </p>
                {reviews.length === 0 && (
                  <button onClick={() => setRequestPanelOpen(true)} className="btn-primary text-[12px]">
                    <Send className="w-3.5 h-3.5" /> Send First Review Request
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReviews.map(review => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-surface/60 border border-border/50 rounded-2xl p-5 shadow-sm hover:border-border/80 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      {review.authorAvatar ? (
                        <img src={review.authorAvatar} alt={review.authorName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-[14px] flex items-center justify-center shrink-0">
                          {review.authorName?.[0]?.toUpperCase() || 'U'}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-bold text-text-main">{review.authorName}</span>
                            <PlatformBadge platform={review.platform} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-text-muted">
                              {new Date(review.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {review.url && (
                              <a href={review.url} target="_blank" rel="noreferrer" className="text-text-muted hover:text-primary transition-colors">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        <StarRow rating={review.rating} size={3} />

                        <p className="text-[13px] text-text-main mt-2 leading-relaxed">{review.body}</p>

                        {/* Reply */}
                        {review.reply ? (
                          <div className="mt-3 ml-4 pl-3 border-l-2 border-primary/30">
                            <p className="text-[11px] font-bold text-primary mb-1">Your response</p>
                            <p className="text-[12px] text-text-muted">{review.reply}</p>
                            <button
                              onClick={() => { setReplyTarget(review); setReplyText(review.reply || ''); }}
                              className="mt-1 text-[11px] text-primary hover:underline"
                            >
                              Edit reply
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setReplyTarget(review); setReplyText(''); }}
                            className="mt-3 text-[12px] font-bold text-primary hover:underline flex items-center gap-1"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Reply to this review
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ Request Reviews Tab ══ */}
        {activeTab === 'request' && (
          <div className="p-6 max-w-2xl">
            <div className="bg-surface/60 border border-border/50 rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-[16px] font-bold text-text-main mb-0.5">Send Review Requests</h2>
                <p className="text-[13px] text-text-muted">
                  Automatically send personalized review requests to your contacts via SMS or email.
                </p>
              </div>

              {/* Channel */}
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-text-main">Send via</label>
                <div className="flex gap-3">
                  {(['sms', 'email'] as const).map(ch => (
                    <button
                      key={ch}
                      onClick={() => setReqForm(p => ({ ...p, channel: ch }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[13px] font-bold transition-all ${
                        reqForm.channel === ch
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'bg-surface-hover border-border/50 text-text-muted hover:text-text-main'
                      }`}
                    >
                      {ch === 'sms' ? <Phone className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                      {ch.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Segment */}
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-text-main">Contact segment</label>
                <select
                  value={reqForm.segmentFilter}
                  onChange={e => setReqForm(p => ({ ...p, segmentFilter: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-surface-hover border border-border/50 rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="recent_customers">Recent Customers (last 30 days)</option>
                  <option value="completed_appointments">Completed Appointments</option>
                  <option value="won_deals">Won Deals</option>
                  <option value="all_contacts">All Contacts</option>
                </select>
              </div>

              {/* Message template */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-bold text-text-main">Message</label>
                  <span className="text-[10px] text-text-muted">Supports: {'{first_name}'}, {'{review_link}'}</span>
                </div>
                <textarea
                  rows={4}
                  value={reqForm.message}
                  onChange={e => setReqForm(p => ({ ...p, message: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-surface-hover border border-border/50 rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary resize-none font-mono"
                />
                <p className="text-[11px] text-text-muted">
                  {'{review_link}'} will be replaced with your unique review request link.
                </p>
              </div>

              {/* Preview */}
              <div className="p-4 bg-surface/40 border border-border/40 rounded-xl">
                <p className="text-[11px] font-bold text-text-muted uppercase mb-2">Preview</p>
                <p className="text-[13px] text-text-main leading-relaxed">
                  {reqForm.message
                    .replace('{first_name}', 'Alex')
                    .replace('{review_link}', 'https://g.page/r/your-review-link')}
                </p>
              </div>

              <button
                disabled={requestMutation.isPending}
                onClick={() => requestMutation.mutate(reqForm)}
                className="btn-primary w-full py-3 text-[14px] flex items-center justify-center gap-2"
              >
                {requestMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Review Request Campaign
              </button>

              <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-400 leading-relaxed">
                  Only contacts who haven't opted out of {reqForm.channel === 'sms' ? 'SMS' : 'email'} communications will receive this message (TCPA/CAN-SPAM compliant).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══ Widget Tab ══ */}
        {activeTab === 'widget' && (
          <div className="p-6 max-w-2xl space-y-5">
            <div className="bg-surface/60 border border-border/50 rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-[16px] font-bold text-text-main mb-0.5">Review Widget</h2>
                <p className="text-[13px] text-text-muted">
                  Embed your live reviews on any website to build trust with visitors.
                </p>
              </div>

              {/* Live preview */}
              <div className="bg-bg border border-border/50 rounded-2xl p-5">
                <p className="text-[11px] font-bold text-text-muted uppercase mb-3">Widget Preview</p>
                <div className="flex items-center gap-4 mb-4">
                  <div>
                    <div className="text-[32px] font-black text-amber-400 leading-none">{avgRating > 0 ? avgRating.toFixed(1) : '4.8'}</div>
                    <StarRow rating={avgRating > 0 ? avgRating : 4.8} size={4} />
                    <p className="text-[11px] text-text-muted mt-1">{stats?.totalReviews || 0} verified reviews</p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map(s => {
                      const count = stats?.distribution?.find(d => d.stars === s)?.count || 0;
                      const total = Math.max(stats?.totalReviews || 1, 1);
                      return (
                        <div key={s} className="flex items-center gap-2">
                          <span className="text-[10px] text-text-muted w-4">{s}</span>
                          <div className="flex-1 h-1.5 bg-border/50 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400/70 rounded-full" style={{ width: `${(count / total) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  {[
                    { author: 'Sarah M.', rating: 5, text: 'Absolutely incredible service! Highly recommend.' },
                    { author: 'James R.', rating: 4, text: 'Great experience, very professional team.' },
                  ].map((ex, i) => (
                    <div key={i} className="flex-1 bg-surface/60 border border-border/40 rounded-xl p-3">
                      <StarRow rating={ex.rating} size={3} />
                      <p className="text-[11px] text-text-main mt-1.5 line-clamp-2">{ex.text}</p>
                      <p className="text-[10px] text-text-muted mt-1.5 font-bold">{ex.author}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code snippet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-bold text-text-main flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-primary" /> Embed Code
                  </label>
                  <button
                    onClick={handleCopyWidget}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all border ${
                      widgetCopied
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-surface-hover border-border/50 text-text-main hover:border-primary/40'
                    }`}
                  >
                    {widgetCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {widgetCopied ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre className="bg-bg border border-border/50 rounded-xl p-4 text-[11px] font-mono text-text-muted overflow-x-auto whitespace-pre-wrap">
                  {widgetSnippet}
                </pre>
                <p className="text-[11px] text-text-muted">
                  Replace <code className="text-primary font-mono">YOUR_WORKSPACE_ID</code> with your workspace ID found in Settings → General.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-surface/40 border border-border/40 rounded-xl">
                  <p className="text-[12px] font-bold text-text-main mb-1">Themes</p>
                  <p className="text-[11px] text-text-muted">data-theme="dark" | "light" | "auto"</p>
                </div>
                <div className="p-4 bg-surface/40 border border-border/40 rounded-xl">
                  <p className="text-[12px] font-bold text-text-main mb-1">Layout</p>
                  <p className="text-[11px] text-text-muted">data-layout="grid" | "carousel" | "compact"</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Reply SlideOver ── */}
      {replyTarget && (
        <SlideOverPanel
          isOpen={true}
          onClose={() => setReplyTarget(null)}
          title="Reply to Review"
          width="w-[480px]"
          footer={
            <>
              <button onClick={() => setReplyTarget(null)} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-text-muted border border-border hover:bg-surface-hover">
                Cancel
              </button>
              <button
                disabled={replyMutation.isPending || !replyText.trim()}
                onClick={() => replyMutation.mutate({ id: replyTarget.id, reply: replyText })}
                className="px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-bold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {replyMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Post Reply
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Original review */}
            <div className="bg-surface-hover/50 border border-border/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] font-bold text-text-main">{replyTarget.authorName}</span>
                <StarRow rating={replyTarget.rating} size={3} />
                <PlatformBadge platform={replyTarget.platform} />
              </div>
              <p className="text-[12px] text-text-muted leading-relaxed">{replyTarget.body}</p>
            </div>

            {/* AI suggested replies */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-text-muted uppercase">Quick Replies</p>
              {[
                replyTarget.rating >= 4
                  ? "Thank you so much for your kind words! We're thrilled you had a great experience and look forward to serving you again."
                  : "We sincerely apologize for falling short of your expectations. Please reach out to us directly and we'll make it right.",
                'We appreciate you taking the time to leave a review. Your feedback means the world to our team!',
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setReplyText(suggestion)}
                  className="w-full text-left p-3 bg-surface/40 border border-border/40 rounded-xl text-[12px] text-text-muted hover:text-text-main hover:border-primary/30 transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Reply textarea */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-text-main">Your Reply</label>
              <textarea
                rows={5}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Write your response..."
                className="w-full px-3.5 py-2.5 bg-surface-hover border border-border/50 rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary resize-none"
              />
              <p className="text-[11px] text-text-muted text-right">{replyText.length} chars</p>
            </div>
          </div>
        </SlideOverPanel>
      )}
    </div>
  );
}
