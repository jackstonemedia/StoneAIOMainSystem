import { Link } from 'react-router-dom';
import { Plus, Activity, Zap, Clock, Bot, MoreVertical, Settings, FileText, GitMerge, Mic, MessageSquare, Sparkles, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    { label: 'Active Agents', value: '3', icon: Bot, color: 'text-green', bgColor: 'bg-green/10' },
    { label: 'Runs Today', value: '142', icon: Activity, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Credits Used', value: '850', icon: Zap, color: 'text-amber', bgColor: 'bg-amber/10' },
    { label: 'Success Rate', value: '98.5%', icon: Clock, color: 'text-teal', bgColor: 'bg-teal/10' },
  ];

  const recentAgents = [
    { id: '1', name: 'Invoice Processor', type: 'Workflow', status: 'Running', lastRun: '2 mins ago', runs: 45, credits: 120, emoji: '🧾' },
    { id: '2', name: 'Sales Receptionist', type: 'Voice', status: 'Running', lastRun: 'Active now', runs: 12, credits: 280, emoji: '📞' },
    { id: '3', name: 'Customer Support Triage', type: 'Autonomous', status: 'Running', lastRun: 'Just now', runs: 89, credits: 450, emoji: '🎧' },
  ];

  const quickActions = [
    { name: 'New Workflow', desc: 'Build an automation', icon: GitMerge, color: 'text-teal bg-teal/10', path: '/agents?type=workflow' },
    { name: 'Voice Agent', desc: 'Deploy a phone agent', icon: Mic, color: 'text-light-purple bg-light-purple/10', path: '/agents?type=voice' },
    { name: 'AI Assistant', desc: 'Chat with your AI', icon: MessageSquare, color: 'text-primary bg-primary/10', path: '/assistant' },
    { name: 'Autonomous', desc: 'Launch a goal agent', icon: Sparkles, color: 'text-purple bg-purple/10', path: '/agents?type=autonomous' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Running': return 'bg-green';
      case 'Paused': return 'bg-amber';
      case 'Error': return 'bg-red';
      default: return 'bg-text-muted';
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'Workflow': return 'bg-teal/10 text-teal border-teal/20';
      case 'Voice': return 'bg-light-purple/10 text-light-purple border-light-purple/20';
      case 'Autonomous': return 'bg-purple/10 text-purple border-purple/20';
      case 'Assistant': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-surface border-border text-text-muted';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-8 animate-fade-up">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Welcome back, Jack</h1>
            <p className="text-sm text-text-muted">Here's what your AI team is up to today.</p>
          </div>
          <Link to="/agents" className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/25 flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Agent
          </Link>
        </header>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 stagger-children">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              to={action.path}
              className="group bg-surface border border-border rounded-xl p-4 hover:border-primary/30 transition-all hover:shadow-md"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${action.color}`}>
                <action.icon className="w-5 h-5" />
              </div>
              <div className="font-medium text-sm mb-0.5 group-hover:text-primary transition-colors">{action.name}</div>
              <div className="text-xs text-text-muted">{action.desc}</div>
            </Link>
          ))}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
          {stats.map((stat) => (
            <div key={stat.label} className="card-primary p-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          ))}
        </div>

        {/* Recent Agents */}
        <div className="card-primary overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold">Recent Agents</h2>
            <Link to="/agents" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          
          <div className="divide-y divide-border">
            {recentAgents.length === 0 ? (
              <div className="text-center py-16 bg-surface rounded-xl border-2 border-dashed border-border m-6">
                <Bot className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-30" />
                <h3 className="font-medium text-text-main mb-2">No agents yet</h3>
                <p className="text-sm text-text-muted mb-6 max-w-xs mx-auto">
                  Create your first agent and start automating tasks.
                </p>
                <Link
                  to="/agents"
                  className="bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Create your first agent
                </Link>
              </div>
            ) : (
              recentAgents.map((agent) => (
                <div key={agent.id} className="px-6 py-4 flex items-center justify-between hover:bg-surface-hover transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center justify-center w-10 h-10 bg-bg border border-border rounded-xl">
                      <span className="text-lg">{agent.emoji || '🤖'}</span>
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-surface ${getStatusColor(agent.status)}`} />
                    </div>
                    
                    <div>
                      <Link to={`/agents/${agent.id}/build`} className="font-medium hover:text-primary transition-colors block mb-0.5">
                        {agent.name}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wider ${getTypeBadge(agent.type)}`}>
                          {agent.type}
                        </span>
                        <span>•</span>
                        <span>Last run: {agent.lastRun}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="hidden md:flex items-center gap-6 text-sm text-text-muted">
                      <div className="text-right">
                        <div className="font-medium text-text-main">{agent.runs}</div>
                        <div className="text-xs">Runs</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-text-main">{agent.credits}</div>
                        <div className="text-xs">Credits</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-text-muted hover:text-text-main hover:bg-bg rounded-lg transition-colors" title="Logs">
                        <FileText className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-text-muted hover:text-text-main hover:bg-bg rounded-lg transition-colors" title="Settings">
                        <Settings className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-text-muted hover:text-text-main hover:bg-bg rounded-lg transition-colors" title="More">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
