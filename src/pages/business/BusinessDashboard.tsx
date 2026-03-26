import { Link } from 'react-router-dom';
import { 
  TrendingUp, Users, Mail, DollarSign, Calendar, FileText, 
  ArrowUpRight, ArrowDownRight, BarChart3, Zap
} from 'lucide-react';

export default function BusinessDashboard() {
  const stats = [
    { label: 'Monthly Revenue', value: '$48,250', change: '+12.5%', up: true, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Pipeline Value', value: '$182,400', change: '+8.2%', up: true, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Active Contacts', value: '2,847', change: '+156', up: true, icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Conversion Rate', value: '24.8%', change: '-1.2%', up: false, icon: BarChart3, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  const recentActivity = [
    { type: 'deal', text: 'Enterprise License deal moved to Negotiation', time: '2 mins ago', icon: DollarSign, color: 'text-emerald-500' },
    { type: 'campaign', text: 'Black Friday email campaign sent to 14.5k contacts', time: '1 hour ago', icon: Mail, color: 'text-blue-500' },
    { type: 'contact', text: '23 new leads imported from web form', time: '3 hours ago', icon: Users, color: 'text-purple-500' },
    { type: 'agent', text: 'Lead Scorer agent completed 142 evaluations', time: '4 hours ago', icon: Zap, color: 'text-amber-500' },
    { type: 'form', text: '"Contact Us" form received 8 new submissions', time: '5 hours ago', icon: FileText, color: 'text-teal-500' },
  ];

  const upcomingEvents = [
    { title: 'Strategy call with Acme Corp', time: '2:00 PM', contact: 'Sarah Chen' },
    { title: 'Demo: Enterprise tier walkthrough', time: '3:30 PM', contact: 'Mike Johnson' },
    { title: 'Follow-up: Contract review', time: '4:15 PM', contact: 'Lisa Wang' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">Business Overview</h1>
          <p className="text-sm text-text-muted mt-1">Your operations at a glance.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5 flex items-start justify-between hover:shadow-md transition-shadow">
              <div>
                <p className="text-sm font-medium text-text-muted mb-1">{stat.label}</p>
                <h3 className="text-2xl font-bold text-text-main">{stat.value}</h3>
                <span className={`text-xs font-medium flex items-center gap-1 mt-1 ${stat.up ? 'text-emerald-500' : 'text-red-500'}`}>
                  {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.change}
                </span>
              </div>
              <div className={`p-2.5 rounded-lg ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="col-span-2 bg-surface border border-border rounded-xl">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-text-main">Recent Activity</h3>
              <Link to="/business/analytics" className="text-xs font-medium text-primary hover:underline">View all →</Link>
            </div>
            <div className="divide-y divide-border">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-hover transition-colors">
                  <div className={`p-2 rounded-lg bg-bg border border-border ${item.color}`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-main truncate">{item.text}</p>
                    <p className="text-xs text-text-muted mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Calendar */}
          <div className="bg-surface border border-border rounded-xl">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-text-main">Today's Schedule</h3>
              <Link to="/business/calendar" className="text-xs font-medium text-primary hover:underline">Full calendar →</Link>
            </div>
            <div className="p-4 space-y-3">
              {upcomingEvents.map((event, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-bg border border-border rounded-lg hover:border-primary/30 transition-colors">
                  <div className="p-1.5 rounded bg-primary/10 text-primary shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-main truncate">{event.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">{event.time} · {event.contact}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'New Campaign', icon: Mail, path: '/business/campaigns', color: 'text-blue-500 bg-blue-500/10' },
            { label: 'Add Contact', icon: Users, path: '/business/crm/contacts', color: 'text-purple-500 bg-purple-500/10' },
            { label: 'Create Form', icon: FileText, path: '/business/forms', color: 'text-teal-500 bg-teal-500/10' },
            { label: 'View Reports', icon: BarChart3, path: '/business/analytics', color: 'text-amber-500 bg-amber-500/10' },
          ].map((action, i) => (
            <Link key={i} to={action.path} className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-primary/30 hover:shadow-md transition-all group">
              <div className={`p-2.5 rounded-lg ${action.color}`}>
                <action.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-text-main group-hover:text-primary transition-colors">{action.label}</span>
              <ArrowUpRight className="w-4 h-4 text-text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
