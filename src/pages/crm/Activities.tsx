import { Search, Filter, Activity as ActivityIcon, Mail, Phone, CalendarDays, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Activity {
  id: string;
  type: string;
  title: string;
  target: string;
  company: string;
  date: string;
}

export default function Activities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/crm/activities')
      .then(res => res.json())
      .then(data => {
        setActivities(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch activities:', err);
        setLoading(false);
      });
  }, []);

  const getIconForType = (type: string) => {
    switch (type) {
      case 'email': return { icon: Mail, color: 'text-blue-500', bg: 'bg-blue-500/10' };
      case 'call': return { icon: Phone, color: 'text-green', bg: 'bg-green/10' };
      case 'meeting': return { icon: CalendarDays, color: 'text-purple', bg: 'bg-purple/10' };
      case 'task': return { icon: CheckCircle2, color: 'text-amber', bg: 'bg-amber/10' };
      default: return { icon: ActivityIcon, color: 'text-slate-500', bg: 'bg-slate-500/10' };
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-border bg-surface shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activities</h1>
          <p className="text-sm text-text-muted mt-1">Timeline of all interactions and updates.</p>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-bg shrink-0">
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search activities..." 
            className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div className="text-center text-text-muted">Loading activities...</div>
          ) : (
            <div className="relative border-l border-border ml-4 space-y-8 pb-8">
              {activities.map((activity) => {
                const { icon: Icon, color, bg } = getIconForType(activity.type);
                return (
                  <div key={activity.id} className="relative pl-8">
                    {/* Timeline dot */}
                    <div className={`absolute -left-4 top-1 w-8 h-8 rounded-full flex items-center justify-center border-4 border-bg ${bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                    </div>
                    
                    {/* Content */}
                    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium">{activity.title}</h3>
                        <span className="text-xs text-text-muted whitespace-nowrap ml-4">{activity.date}</span>
                      </div>
                      <div className="text-sm text-text-muted">
                        With <span className="font-medium text-text-main">{activity.target}</span> at {activity.company}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
