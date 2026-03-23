import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Star, Download, Bot, Zap, Clock } from 'lucide-react';

export default function Marketplace() {
  const [activeTab, setActiveTab] = useState('all');

  const agents = [
    { id: 1, name: 'Customer Support Bot', author: 'Stone AIO', rating: 4.9, reviews: 128, type: 'Autonomous', price: 'Free', icon: Bot, color: 'text-purple' },
    { id: 2, name: 'Stripe Invoice to Sheets', author: 'FinanceOps', rating: 4.7, reviews: 56, type: 'Reactive', price: '$5/mo', icon: Zap, color: 'text-primary' },
    { id: 3, name: 'Weekly SEO Report', author: 'MarketingPro', rating: 4.8, reviews: 92, type: 'Scheduled', price: 'Free', icon: Clock, color: 'text-amber' },
    { id: 4, name: 'GitHub PR Reviewer', author: 'DevTools', rating: 4.5, reviews: 34, type: 'Reactive', price: 'Free', icon: Zap, color: 'text-primary' },
    { id: 5, name: 'Lead Enrichment Pipeline', author: 'SalesHacker', rating: 4.6, reviews: 71, type: 'Autonomous', price: '$10/mo', icon: Bot, color: 'text-purple' },
    { id: 6, name: 'Daily Standup Summary', author: 'AgileTeam', rating: 4.9, reviews: 210, type: 'Scheduled', price: 'Free', icon: Clock, color: 'text-amber' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Marketplace</h1>
        <p className="text-sm text-text-muted">Discover and deploy pre-built agents from the community.</p>
      </header>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {['All', 'Customer Support', 'Sales & CRM', 'Marketing', 'Engineering'].map(filter => (
            <button
              key={filter}
              onClick={() => setActiveTab(filter.toLowerCase())}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === filter.toLowerCase()
                  ? 'bg-text-main text-bg' 
                  : 'bg-surface border border-border text-text-muted hover:text-text-main'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search agents..." 
              className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
            />
          </div>
          <button className="p-2 bg-surface border border-border rounded-md text-text-muted hover:text-text-main transition-colors">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-surface border border-border rounded-xl p-6 hover:border-primary/50 transition-colors group">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-bg border border-border flex items-center justify-center ${agent.color}`}>
                <agent.icon className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full bg-surface-hover text-xs font-medium text-text-muted">
                {agent.type}
              </span>
            </div>

            <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">{agent.name}</h3>
            <p className="text-sm text-text-muted mb-4">by {agent.author}</p>

            <div className="flex items-center gap-4 text-sm font-medium text-text-muted mb-6">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber fill-amber" /> {agent.rating} ({agent.reviews})
              </div>
              <div className="flex items-center gap-1">
                <Download className="w-4 h-4" /> 1.2k
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="font-semibold">{agent.price}</span>
              <button className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
                Deploy
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
