import { useState } from 'react';
import { Search, Filter, Play, ArrowRight, Bot, MessageSquare, Database, Users, LineChart, Link as LinkIcon, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

const categories = ['All', 'Sales', 'Marketing', 'Customer Support', 'Data Processing', 'HR & IT'];

const templates = [
  {
    id: 'sales-1',
    category: 'Sales',
    title: 'Lead Follow-up Sequence',
    description: 'Automatically reach out to new CRM leads with a personalized AI email and schedule a follow-up task.',
    icons: [Users, Bot, Mail],
    nodes: 8,
    plays: '12.4k'
  },
  {
    id: 'support-1',
    category: 'Customer Support',
    title: 'Ticket Triage & Routing',
    description: 'Analyze incoming Zendesk tickets using LLM sentiment and auto-route to the correct priority queue.',
    icons: [MessageSquare, Bot, LinkIcon],
    nodes: 5,
    plays: '8.2k'
  },
  {
    id: 'data-1',
    category: 'Data Processing',
    title: 'Invoice Data Extraction',
    description: 'Extract line items and totals from PDF invoices via email and push them directly to Quickbooks.',
    icons: [Mail, Database, LineChart],
    nodes: 12,
    plays: '45.1k'
  },
  {
    id: 'marketing-1',
    category: 'Marketing',
    title: 'Social Media Auto-Poster',
    description: 'Monitor RSS feeds, summarize articles with an LLM, and schedule optimized posts for LinkedIn and Twitter.',
    icons: [LinkIcon, Bot, MessageSquare],
    nodes: 6,
    plays: '3.9k'
  },
  {
    id: 'marketing-carousel',
    category: 'Marketing',
    title: 'Carousel Post Generator',
    description: 'Create engaging multi-page carousel content for Instagram and LinkedIn automatically from trending topics and news.',
    icons: [Users, LineChart, Bot],
    nodes: 4,
    plays: '8.4k'
  }
];

export default function WorkflowTemplates() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = templates.filter(t => {
    const matchesCat = activeCategory === 'All' || t.category === activeCategory;
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">Workflow Templates</h1>
          <p className="text-text-muted text-lg max-w-2xl">Deploy pre-built, production-ready AI automations in seconds. Customize them to fit your exact business needs.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/agents/new" className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
            Build from scratch
          </Link>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters Sidebar */}
        <div className="w-full lg:w-64 shrink-0 space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4" /> Categories
            </h3>
            <div className="flex flex-col gap-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeCategory === cat ? 'bg-primary/10 text-primary' : 'hover:bg-surface text-text-muted hover:text-text-main'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 grid md:grid-cols-2 gap-6">
          {filtered.map(template => (
            <div key={template.id} className="group bg-surface border border-border rounded-2xl p-6 hover:shadow-xl hover:border-primary/30 transition-all duration-300 flex flex-col h-full bg-gradient-to-br from-surface to-bg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
              
              <div className="relative z-10 flex items-start justify-between mb-4">
                <div className="flex -space-x-2">
                  {template.icons.map((Icon, idx) => (
                    <div key={idx} className="w-8 h-8 rounded-full bg-bg border border-border flex items-center justify-center shrink-0 shadow-sm relative z-20" style={{ zIndex: 10 - idx }}>
                      <Icon className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
                    </div>
                  ))}
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-bg border border-border text-text-muted">
                  {template.category}
                </span>
              </div>
              
              <div className="relative z-10 flex-1">
                <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">{template.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed mb-6">{template.description}</p>
              </div>

              <div className="relative z-10 flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                <div className="flex items-center gap-4 text-xs font-medium text-text-muted">
                  <span className="flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /> {template.plays} uses</span>
                  <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5" /> {template.nodes} nodes</span>
                </div>
                <Link 
                  to={template.id.includes('carousel') ? '/agents/carousel/new' : '/agents/new'} 
                  className="p-2 bg-primary/10 text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition-all shadow-sm"
                >
                  <ArrowRight className="w-4 h-4 group-hover:-rotate-45 transition-transform" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
