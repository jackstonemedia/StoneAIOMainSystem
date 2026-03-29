import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReviews, createReview } from '../../lib/api';
import { 
  Star, MessageSquare, ThumbsUp, ThumbsDown, TrendingUp, 
  ExternalLink, Send, Filter, BarChart3, Plus
} from 'lucide-react';

interface Review {
  id: string;
  source: 'google' | 'yelp' | 'facebook';
  author: string;
  rating: number;
  text: string;
  date: string;
  replied: boolean;
}

export default function Reputation() {
  const queryClient = useQueryClient();
  const [activeSource, setActiveSource] = useState<'all' | 'google' | 'yelp' | 'facebook'>('all');

  const { data: reviews = [], isLoading } = useQuery<any[]>({
    queryKey: ['reviews'],
    queryFn: getReviews
  });

  const createMutation = useMutation<any, Error, any>({
    mutationFn: createReview,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews'] })
  });

  const handleCreateTestReview = () => {
    createMutation.mutate({
      author: 'Test User ' + Math.floor(Math.random() * 100),
      rating: Math.max(1, Math.floor(Math.random() * 6)),
      text: 'This is a test review generated from the dashboard to verify database integration.',
      source: ['google', 'yelp', 'facebook'][Math.floor(Math.random() * 3)]
    });
  };

  const filtered = reviews.filter((r: any) => activeSource === 'all' || r.source === activeSource);
  const avgRating = reviews.length > 0 ? (reviews.reduce((a: number, r: any) => a + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
  const positiveCount = reviews.filter((r: any) => r.rating >= 4).length;
  const negativeCount = reviews.filter((r: any) => r.rating <= 2).length;

  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-main tracking-tight">Reputation Manager</h1>
            <p className="text-sm text-text-muted mt-1">Monitor and respond to reviews across all platforms.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleCreateTestReview}
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-main border border-border rounded-lg hover:bg-surface-hover transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Test Review
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-all shadow-md shadow-primary/20">
              <Send className="w-4 h-4" /> Request Reviews
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-muted">Average Rating</span>
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-text-main">{avgRating}</h3>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className={`w-4 h-4 ${s <= Math.round(Number(avgRating)) ? 'text-amber-500 fill-amber-500' : 'text-border'}`} />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-muted">Total Reviews</span>
              <MessageSquare className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="text-3xl font-bold text-text-main">{reviews.length}</h3>
            <span className="text-xs text-emerald-500 font-medium">+3 this month</span>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-muted">Positive</span>
              <ThumbsUp className="w-5 h-5 text-emerald-500" />
            </div>
            <h3 className="text-3xl font-bold text-text-main">{positiveCount}</h3>
            <span className="text-xs text-text-muted">{reviews.length > 0 ? ((positiveCount / reviews.length) * 100).toFixed(0) : 0}% of total</span>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-muted">Needs Attention</span>
              <ThumbsDown className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="text-3xl font-bold text-text-main">{negativeCount}</h3>
            <span className="text-xs text-text-muted">{negativeCount} unresponded</span>
          </div>
        </div>

        {/* Sentiment Bar */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-text-main flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Sentiment Breakdown
            </h3>
            <span className="text-xs text-text-muted">Based on {reviews.length} reviews</span>
          </div>
          <div className="flex rounded-full overflow-hidden h-3">
            <div className="bg-emerald-500" style={{ width: '80%' }} />
            <div className="bg-amber-500" style={{ width: '10%' }} />
            <div className="bg-red-500" style={{ width: '10%' }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-text-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Positive 80%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Neutral 10%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Negative 10%</span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex bg-surface p-1 rounded-lg border border-border">
            {[
              { id: 'all', label: 'All Sources' },
              { id: 'google', label: 'Google' },
              { id: 'yelp', label: 'Yelp' },
              { id: 'facebook', label: 'Facebook' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSource(tab.id as any)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeSource === tab.id ? 'bg-bg text-primary shadow-sm border border-border' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-surface-hover text-text-main">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="p-8 text-center text-text-muted text-sm border border-border rounded-xl bg-surface">Loading reviews...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm border border-border rounded-xl bg-surface">No reviews found.</div>
          ) : filtered.map((review: any) => (
            <div key={review.id} className="bg-surface border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {review.author[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-text-main">{review.author}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-bg border border-border text-text-muted">
                        {review.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'text-amber-500 fill-amber-500' : 'text-border'}`} />
                        ))}
                      </div>
                      <span className="text-xs text-text-muted">· {new Date(review.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="text-xs font-medium text-primary hover:underline">Reply</button>
                  <button className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-md">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-text-main mt-3 leading-relaxed">{review.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
