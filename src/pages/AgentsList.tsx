import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Bot, GitMerge, Mic, Sparkles, MoreVertical, Play, Pause, Settings, Trash2, Clock, Zap, Layers, MessageSquare } from 'lucide-react';

export default function AgentsList() {
  const [searchParams] = useSearchParams();
  const typeFilter = searchParams.get('type') || 'all';
  const [search, setSearch] = useState('');

  const agents = [
    { id: '1', name: 'Invoice Processor', type: 'workflow', status: 'active', lastRun: '2 mins ago', runs: 1240, credits: 3400, description: 'Extracts invoice data from emails and updates accounting system', emoji: '🧾' },
    { id: '2', name: 'Sales Receptionist', type: 'voice', status: 'active', lastRun: 'Active now', runs: 356, credits: 8200, description: 'Handles inbound sales calls and qualifies leads', emoji: '📞' },
    { id: '4', name: 'Weekly Report Generator', type: 'workflow', status: 'paused', lastRun: '3 days ago', runs: 52, credits: 150, description: 'Generates weekly performance reports from analytics data', emoji: '📊' },
    { id: '6', name: 'Meeting Scheduler', type: 'voice', status: 'paused', lastRun: '1 day ago', runs: 89, credits: 920, description: 'Handles appointment booking via phone calls', emoji: '📅' },
  ];

  const filteredAgents = agents.filter(a => {
    const matchesType = typeFilter === 'all' || a.type === typeFilter;
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const typeConfig: Record<string, { label: string; color: string; icon: typeof Bot }> = {
    workflow: { label: 'Workflow', color: 'bg-teal/10 text-teal border-teal/20', icon: GitMerge },
    voice: { label: 'Voice', color: 'bg-light-purple/10 text-light-purple border-light-purple/20', icon: Mic },
    assistant: { label: 'Assistant', color: 'bg-primary/10 text-primary border-primary/20', icon: MessageSquare },
  };

  const filterTabs = [
    { id: 'all', label: 'All Agents', count: agents.length },
    { id: 'workflow', label: 'Workflows', count: agents.filter(a => a.type === 'workflow').length },
    { id: 'voice', label: 'Voice', count: agents.filter(a => a.type === 'voice').length },
  ];

  const getStatusDot = (status: string) => {
    return status === 'active' ? 'bg-green' : status === 'paused' ? 'bg-amber' : 'bg-red';
  };

  // Determine the creation route based on active tab
  const getCreateRoute = () => {
    switch(typeFilter) {
      case 'voice': return '/agents/voice/new';
      case 'workflow': return '/agents/workflow/new';
      case 'assistant': return '/assistant';
      default: return '/agents/new';
    }
  };

  const getCreateLabel = () => {
    switch(typeFilter) {
      case 'voice': return 'Create Voice Agent';
      case 'workflow': return 'Create Workflow';
      case 'assistant': return 'Create AI Assistant';
      default: return 'Create Agent';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 lg:p-12 relative">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6 animate-fade-up">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Agents</h1>
            <p className="text-sm text-text-muted">Manage, monitor, and deploy your AI agents.</p>
          </div>
          <Link 
            to={getCreateRoute()} 
            className="bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/25 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> {getCreateLabel()}
          </Link>
        </header>

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Type Tabs */}
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
            {filterTabs.map((tab) => (
              <Link
                key={tab.id}
                to={tab.id === 'all' ? '/agents' : `/agents?type=${tab.id}`}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  typeFilter === tab.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  typeFilter === tab.id ? 'bg-primary/20 text-primary' : 'bg-bg text-text-muted'
                }`}>
                  {tab.count}
                </span>
              </Link>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Agent Grid */}
        {filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 relative animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* Background Glows based on type */}
            {typeFilter === 'workflow' && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal/10 rounded-full blur-3xl opacity-50" />}
            {typeFilter === 'voice' && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-light-purple/10 rounded-full blur-3xl opacity-50" />}
            {typeFilter === 'autonomous' && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple/10 rounded-full blur-3xl opacity-50" />}
            {typeFilter === 'assistant' && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50" />}
            
            <div className={`p-6 rounded-3xl mb-8 relative z-10 border shadow-2xl ${
              typeFilter === 'workflow' ? 'bg-teal/10 border-teal/20 text-teal' :
              typeFilter === 'voice' ? 'bg-light-purple/10 border-light-purple/20 text-light-purple' :
              typeFilter === 'autonomous' ? 'bg-purple/10 border-purple/20 text-purple' :
              typeFilter === 'assistant' ? 'bg-primary/10 border-primary/20 text-primary' :
              'bg-surface border-border text-text-muted'
            }`}>
              {typeFilter === 'workflow' ? <GitMerge className="w-16 h-16" /> :
               typeFilter === 'voice' ? <Mic className="w-16 h-16" /> :
               typeFilter === 'autonomous' ? <Bot className="w-16 h-16" /> :
               typeFilter === 'assistant' ? <Sparkles className="w-16 h-16" /> :
               <Layers className="w-16 h-16" />}
            </div>

            <h2 className="text-3xl font-bold tracking-tight mb-4 text-gradient z-10 text-center relative">
              {typeFilter === 'workflow' ? 'Welcome to Workflow Agents' :
               typeFilter === 'voice' ? 'Meet your new Voice Agents' :
               typeFilter === 'autonomous' ? 'Deploy Autonomous Workers' :
               typeFilter === 'assistant' ? 'Your Personal AI Assistant' :
               search ? 'No agents found matching your search' :
               'Welcome to Stone AIO Agents'}
            </h2>

            <p className="text-text-muted text-lg mb-10 max-w-xl text-center z-10 relative">
              {search ? 'Try adjusting your search terms or filters.' :
               typeFilter === 'workflow' ? 'Automate your entire business using our visual node builder. Connect over 500 apps to build powerful, AI-driven automation sequences.' :
               typeFilter === 'voice' ? 'Handle customer service and sales calls 24/7. Connect your CRM and deploy hyper-realistic AI voice agents in minutes.' :
               typeFilter === 'autonomous' ? 'Give your AI a goal and let it figure out the steps. Autonomous agents research, plan, and execute tasks on their own within your Cloud Computer.' :
               typeFilter === 'assistant' ? 'Always by your side. Create specialized assistants to answer questions, analyze data, and help you navigate your workspace.' :
               'Start building your AI workforce. Choose an agent architecture to begin automating tasks, handling calls, or researching leads.'}
            </p>

            <Link
              to={getCreateRoute()}
              className="px-8 py-4 rounded-xl text-base font-bold text-white bg-primary hover:bg-primary-hover transition-all shadow-lg hover:shadow-primary/30 flex items-center gap-3 group relative z-10"
            >
              <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" /> 
              {search ? 'Clear Search & Create' : getCreateLabel()}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
            {filteredAgents.map((agent) => {
              const config = typeConfig[agent.type];
              return (
                <div
                  key={agent.id}
                  className="bg-surface/40 backdrop-blur-xl border border-border/60 rounded-2xl p-6 hover:border-primary/40 transition-all hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] group relative overflow-hidden"
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 ${config.color.split(' ')[0]} rounded-bl-full -mr-8 -mt-8 opacity-20 transition-transform group-hover:scale-110`} />
                  {/* Top Row: Icon + Status + Actions */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-bg border border-border rounded-xl flex items-center justify-center text-lg relative">
                        {agent.emoji}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface ${getStatusDot(agent.status)}`} />
                      </div>
                      <div>
                        <Link to={`/agents/${agent.id}/build`} className="font-semibold text-sm hover:text-primary transition-colors block">
                          {agent.name}
                        </Link>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wider mt-0.5 ${config.color}`}>
                          <config.icon className="w-2.5 h-2.5" />
                          {config.label}
                        </span>
                      </div>
                    </div>
                    <button className="p-1.5 text-text-muted hover:text-text-main hover:bg-bg rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-text-muted leading-relaxed mb-4">{agent.description}</p>

                  {/* Stats Row */}
                  <div className="flex items-center gap-4 text-xs text-text-muted mb-4">
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3" /> {agent.runs.toLocaleString()} runs
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {agent.lastRun}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <span className="text-xs text-text-muted">{agent.credits.toLocaleString()} credits</span>
                    <div className="flex items-center gap-1">
                      <button 
                        className={`p-1.5 rounded-lg transition-colors ${
                          agent.status === 'active' ? 'text-amber hover:bg-amber/10' : 'text-green hover:bg-green/10'
                        }`}
                        title={agent.status === 'active' ? 'Pause' : 'Start'}
                      >
                        {agent.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <Link to={`/agents/${agent.id}/build`} className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                        <Settings className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Create New Agent Card */}
            <Link
              to={getCreateRoute()}
              className="border-2 border-dashed border-border rounded-xl p-5 flex flex-col items-center justify-center text-center hover:border-primary/50 hover:bg-primary/5 transition-all min-h-[200px] group"
            >
              <div className="w-12 h-12 bg-surface border border-border rounded-xl flex items-center justify-center mb-3 group-hover:bg-primary/10 transition-colors">
                <Plus className="w-6 h-6 text-text-muted group-hover:text-primary transition-colors" />
              </div>
              <span className="font-medium text-sm text-text-muted group-hover:text-primary transition-colors">{getCreateLabel()}</span>
              {typeFilter === 'all' && (
                <span className="text-xs text-text-muted mt-1">Workflow, Voice, Autonomous, or Assistant</span>
              )}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
