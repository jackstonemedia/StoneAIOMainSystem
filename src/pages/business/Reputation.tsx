import { useState } from 'react';
import { 
  Star, MessageSquare, ThumbsUp, ThumbsDown, TrendingUp, 
  ExternalLink, Send, Filter, BarChart3
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

const mockReviews: Review[] = [
  { id: '1', source: 'google', author: 'Sarah M.', rating: 5, text: 'Absolutely amazing service! The AI assistant was incredibly helpful and fast. Best experience I\'ve had.', date: '2 days ago', replied: true },
  { id: '2', source: 'google', author: 'James K.', rating: 4, text: 'Great product, very easy to set up. Would love to see more integrations in the future.', date: '4 days ago', replied: false },
  { id: '3', source: 'yelp', author: 'Maria L.', rating: 5, text: 'Game changer for our business. The workflow automation saved us 20+ hours per week.', date: '1 week ago', replied: true },
  { id: '4', source: 'facebook', author: 'David P.', rating: 3, text: 'Good platform but had some issues with the calendar sync. Support was helpful though.', date: '1 week ago', replied: false },
  { id: '5', source: 'google', author: 'Emma T.', rating: 5, text: 'The voice agent feature is absolutely incredible. Our customers love it!', date: '2 weeks ago', replied: true },
];

export default function Reputation() {
  const [activeSource, setActiveSource] = useState<'all' | 'google' | 'yelp' | 'facebook'>('all');

  const filtered = mockReviews.filter(r => activeSource === 'all' || r.source === activeSource);
  const avgRating = (mockReviews.reduce((a, r) => a + r.rating, 0) / mockReviews.length).toFixed(1);
  const positiveCount = mockReviews.filter(r => r.rating >= 4).length;
  const negativeCount = mockReviews.filter(r => r.rating <= 2).length;

  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-main tracking-tight">Reputation Manager</h1>
            <p className="text-sm text-text-muted mt-1">Monitor and respond to reviews across all platforms.</p>
          </div>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-all shadow-md shadow-primary/20">
            <Send className="w-4 h-4" /> Request Reviews
          </button>
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
            <h3 className="text-3xl font-bold text-text-main">{mockReviews.length}</h3>
            <span className="text-xs text-emerald-500 font-medium">+3 this month</span>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-muted">Positive</span>
              <ThumbsUp className="w-5 h-5 text-emerald-500" />
            </div>
            <h3 className="text-3xl font-bold text-text-main">{positiveCount}</h3>
            <span className="text-xs text-text-muted">{((positiveCount / mockReviews.length) * 100).toFixed(0)}% of total</span>
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
            <span className="text-xs text-text-muted">Based on {mockReviews.length} reviews</span>
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

        {/* Reviews List */}
        <div className="space-y-4">
          {filtered.map(review => (
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
                      <span className="text-xs text-text-muted">· {review.date}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {review.replied ? (
                    <span className="text-xs text-emerald-500 font-medium">✓ Replied</span>
                  ) : (
                    <button className="text-xs font-medium text-primary hover:underline">Reply</button>
                  )}
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
