import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Star, Download, Bot, Zap, Clock, Loader2 } from 'lucide-react';
import { useToast } from '../components/ui/Toast';

const CATEGORIES = ['All', 'Customer Support', 'Sales & CRM', 'Marketing', 'Engineering'];

const AGENTS = [
  { id: 1, name: 'Customer Support Bot',     author: 'Stone AIO',    rating: 4.9, reviews: 128, type: 'Autonomous', category: 'customer support', price: 'Free',   free: true,  icon: Bot,  color: 'text-purple',  agentType: 'assistant' },
  { id: 2, name: 'Stripe Invoice to Sheets', author: 'FinanceOps',   rating: 4.7, reviews: 56,  type: 'Reactive',   category: 'sales & crm',     price: '$5/mo',  free: false, icon: Zap,  color: 'text-primary', agentType: 'workflow' },
  { id: 3, name: 'Weekly SEO Report',        author: 'MarketingPro', rating: 4.8, reviews: 92,  type: 'Scheduled',  category: 'marketing',       price: 'Free',   free: true,  icon: Clock,color: 'text-amber',   agentType: 'workflow' },
  { id: 4, name: 'GitHub PR Reviewer',       author: 'DevTools',     rating: 4.5, reviews: 34,  type: 'Reactive',   category: 'engineering',     price: 'Free',   free: true,  icon: Zap,  color: 'text-primary', agentType: 'workflow' },
  { id: 5, name: 'Lead Enrichment Pipeline', author: 'SalesHacker',  rating: 4.6, reviews: 71,  type: 'Autonomous', category: 'sales & crm',     price: '$10/mo', free: false, icon: Bot,  color: 'text-purple',  agentType: 'autonomous' },
  { id: 6, name: 'Daily Standup Summary',    author: 'AgileTeam',    rating: 4.9, reviews: 210, type: 'Scheduled',  category: 'engineering',     price: 'Free',   free: true,  icon: Clock,color: 'text-amber',   agentType: 'workflow' },
];

export default function Marketplace() {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [deployingId, setDeployingId] = useState<number | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const filteredAgents = AGENTS.filter(agent => {
    const matchesCategory = activeTab === 'all' || agent.category === activeTab;
    const matchesSearch = !search || agent.name.toLowerCase().includes(search.toLowerCase()) || agent.author.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleDeploy = async (agent: typeof AGENTS[0]) => {
    if (!agent.free) {
      toast('info', `${agent.name} requires a subscription. Billing coming soon.`);
      return;
    }
    setDeployingId(agent.id);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agent.name,
          type: agent.agentType,
          status: 'draft',
          config: JSON.stringify({ source: 'marketplace', templateId: agent.id }),
        }),
      });
      if (!res.ok) throw new Error('Failed to deploy');
      const newAgent = await res.json();
      toast('success', `${agent.name} deployed! Opening builder...`);
      setTimeout(() => {
        if (agent.agentType === 'voice') navigate(`/agents/voice/${newAgent.id}/build`);
        else navigate(`/agents/${newAgent.id}/build`);
      }, 800);
    } catch (err) {
      toast('error', 'Failed to deploy agent. Please try again.');
    } finally {
      setDeployingId(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Marketplace</h1>
        <p className="text-sm text-text-muted">Discover and deploy pre-built agents from the community.</p>
      </header>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {CATEGORIES.map(filter => (
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

        {/* Search + Filter */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
            />
          </div>
          <button className="p-2 bg-surface border border-border rounded-md text-text-muted hover:text-text-main transition-colors">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filteredAgents.length === 0 ? (
        <div className="text-center py-24">
          <Bot className="w-12 h-12 mx-auto mb-4 text-text-muted opacity-30" />
          <h3 className="font-semibold text-text-main mb-1">No agents found</h3>
          <p className="text-sm text-text-muted">Try a different search term or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => {
            const isDeploying = deployingId === agent.id;
            return (
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
                  <button
                    onClick={() => handleDeploy(agent)}
                    disabled={isDeploying}
                    className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isDeploying ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deploying...</>
                    ) : (
                      'Deploy'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
