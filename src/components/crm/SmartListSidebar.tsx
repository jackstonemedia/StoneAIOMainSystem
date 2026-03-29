import { ListFilter, Users, Star, Clock, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface SmartList {
  id: string;
  name: string;
  icon: any;
  count: number;
}

interface SmartListSidebarProps {
  activeListId: string;
  onSelectList: (id: string) => void;
}

export default function SmartListSidebar({ activeListId, onSelectList }: SmartListSidebarProps) {
  const [lists] = useState<SmartList[]>([
    { id: 'all', name: 'All Contacts', icon: Users, count: 142 },
    { id: 'hot_leads', name: 'Hot Leads', icon: Star, count: 28 },
    { id: 'recent', name: 'Recently Active', icon: Clock, count: 56 },
    { id: 'uncontacted', name: 'Uncontacted', icon: AlertCircle, count: 12 },
  ]);

  return (
    <div className="w-64 border-r border-border bg-bg/50 h-full flex flex-col shrink-0">
      <div className="p-4 border-b border-border">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
          <ListFilter className="w-3.5 h-3.5" /> Smart Lists
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        {lists.map((list) => {
          const Icon = list.icon;
          const isActive = activeListId === list.id;
          
          return (
            <button
              key={list.id}
              onClick={() => onSelectList(list.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' 
                  : 'text-text-main hover:bg-surface border border-transparent hover:border-border/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-text-muted'}`} />
                {list.name}
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                isActive ? 'bg-primary text-primary-foreground' : 'bg-surface border border-border text-text-muted'
              }`}>
                {list.count}
              </span>
            </button>
          );
        })}
      </div>
      
      <div className="p-4 border-t border-border">
        <button className="w-full py-2 text-sm font-medium text-text-muted hover:text-text-main bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors">
          + Create Smart List
        </button>
      </div>
    </div>
  );
}
