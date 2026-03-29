import { Search, Filter, Activity as ActivityIcon, Mail, Phone, CalendarDays, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { SmartTable, Column, TableGroup } from '../../components/crm/SmartTable';

interface Activity {
  id: string;
  type: string;
  title: string;
  target: string;
  company: string;
  date: string;
}

export default function Activities() {
  const { data: activities = [], isLoading: loading } = useQuery<Activity[]>({
    queryKey: ['activities'],
    queryFn: () => fetch('/api/crm/activities').then(res => res.json())
  });

  const getActivityColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'email': return 'bg-sky-500 text-white';
      case 'call': return 'bg-orange-500 text-white';
      case 'meeting': return 'bg-[#004e89] text-white'; // Dark blue from Monday
      case 'task': return 'bg-amber-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const getStatusColor = () => {
     return 'bg-[#00c875] text-white'; // Monday 'Done' green
  };

  const tableColumns: Column<Activity>[] = [
    {
      key: 'title',
      header: 'Activity',
      width: '30%',
      render: (a) => <span className="font-medium text-text-main group-hover/row:text-primary transition-colors">{a.title}</span>
    },
    {
      key: 'owner',
      header: 'Owner',
      align: 'center',
      width: '80px',
      render: () => (
        <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center mx-auto shadow-sm">
           <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">J</div>
        </div>
      )
    },
    {
      key: 'type',
      header: 'Activity Type',
      align: 'center',
      width: '180px',
      render: (a) => (
        <div className={`w-full py-1.5 text-xs font-semibold text-center rounded shadow-sm ${getActivityColor(a.type)}`}>
           {a.type.charAt(0).toUpperCase() + a.type.slice(1)}
        </div>
      )
    },
    {
      key: 'date',
      header: 'Start time',
      align: 'left',
      width: '150px',
      render: (a) => <span className="text-sm text-text-muted">{a.date}</span>
    },
    {
      key: 'endTime',
      header: 'End time',
      align: 'left',
      width: '150px',
      render: (a) => <span className="text-sm text-text-muted">{a.date}</span> // Mocking end time
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '120px',
      render: () => (
         <div className={`w-full py-1.5 text-xs font-semibold text-center rounded shadow-sm ${getStatusColor()}`}>
           Done
         </div>
      )
    },
    {
       key: 'related',
       header: 'Related item',
       align: 'center',
       width: '150px',
       render: (a) => (
         <div className="flex items-center gap-1.5 justify-center mx-auto text-xs font-medium bg-surface border border-border px-3 py-1 rounded text-text-muted hover:border-primary/50 cursor-pointer w-full text-center truncate">
           <div className="w-1.5 h-4 bg-sky-500 rounded-sm shrink-0" />
           <span className="truncate">{a.target}</span>
         </div>
       )
    }
  ];

  const tableGroups: TableGroup<Activity>[] = [
    {
      id: 'account_activities',
      title: 'Account Activities',
      color: 'bg-blue-400',
      items: activities
    }
  ];

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

      {/* Timeline Table */}
      <div className="flex-1 overflow-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted">Loading activities...</div>
        ) : (
          <main className="max-w-[1400px]">
            <SmartTable 
              columns={tableColumns} 
              groups={tableGroups} 
              addLabel="+ Add activity"
            />
          </main>
        )}
      </div>
    </div>
  );
}
