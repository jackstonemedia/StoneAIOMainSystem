import { useState, useEffect } from 'react';
import {
  Search, Zap, GitBranch, Database,
  MessageSquare, Bot, ChevronDown, ChevronRight,
  LayoutGrid, Box, Plus,
} from 'lucide-react';
import { apiClient } from '../../../lib/apiClient';

const CATEGORY_COLORS: Record<string, string> = {
  trigger:       '#F59E0B',
  logic:         '#8B5CF6',
  crm:           '#10B981',
  communication: '#06B6D4',
  ai:            '#F97316',
  data:          '#3B82F6',
};

const CATEGORY_ICONS: Record<string, any> = {
  trigger:       Zap,
  logic:         GitBranch,
  crm:           LayoutGrid,
  communication: MessageSquare,
  ai:            Bot,
  data:          Database,
};

export function NativeNodeLibrary({ onAddNode }: { onAddNode: (nodeImpl: any) => void }) {
  const [search, setSearch] = useState('');
  const [catalog, setCatalog] = useState<{ category: string; nodes: any[] }[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/workflows/nodes/catalog')
      .then(res => setCatalog(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const onDragStart = (event: React.DragEvent, nodeImpl: any) => {
    event.dataTransfer.setData('application/reactflow-native-node', JSON.stringify(nodeImpl));
    event.dataTransfer.effectAllowed = 'move';
  };

  const toggleCategory = (cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const filteredCatalog = catalog.map(group => ({
    ...group,
    nodes: group.nodes.filter(n =>
      !search || n.displayName.toLowerCase().includes(search.toLowerCase()) ||
      n.description?.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(group => group.nodes.length > 0);

  return (
    <div className="w-64 border-l border-border bg-surface flex flex-col h-full z-10 shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Node Library</p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-bg border border-border rounded-lg text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {isLoading ? (
          <div className="flex flex-col gap-2 px-3 pt-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-bg rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredCatalog.length === 0 ? (
          <div className="text-center py-10 px-4">
            <Box className="w-6 h-6 text-text-muted mx-auto mb-2 opacity-50" />
            <p className="text-xs text-text-muted">No nodes match</p>
          </div>
        ) : (
          filteredCatalog.map(group => {
            const Icon = CATEGORY_ICONS[group.category] ?? Box;
            const color = CATEGORY_COLORS[group.category] ?? '#52677D';
            const isCollapsed = collapsed[group.category] && !search;

            return (
              <div key={group.category} className="mb-1">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(group.category)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg/60 transition-colors group"
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    <Icon className="w-3 h-3" style={{ color }} />
                  </div>
                  <span className="text-[11px] font-semibold text-text-main capitalize flex-1 text-left">
                    {group.category}
                  </span>
                  <span className="text-[10px] text-text-muted mr-1">{group.nodes.length}</span>
                  {isCollapsed
                    ? <ChevronRight className="w-3 h-3 text-text-muted" />
                    : <ChevronDown className="w-3 h-3 text-text-muted" />
                  }
                </button>

                {/* Nodes */}
                {!isCollapsed && (
                  <div className="px-2 pb-1 space-y-0.5">
                    {group.nodes.map(nodeImpl => (
                      <div
                        key={nodeImpl.type}
                        draggable
                        onDragStart={(e) => onDragStart(e, nodeImpl)}
                        onClick={() => onAddNode(nodeImpl)}
                        className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-bg/0 hover:bg-bg border border-transparent hover:border-border cursor-grab active:cursor-grabbing transition-all"
                        title={nodeImpl.description}
                      >
                        {/* Icon dot */}
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                          style={{ backgroundColor: nodeImpl.color || color }}
                        >
                          {nodeImpl.type.startsWith('trigger.')
                            ? <Zap className="w-3 h-3 text-white" />
                            : <Plus className="w-3 h-3 text-white" />
                          }
                        </div>

                        {/* Label */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text-main truncate leading-tight group-hover:text-primary transition-colors">
                            {nodeImpl.displayName}
                          </p>
                          {nodeImpl.description && (
                            <p className="text-[10px] text-text-muted truncate leading-tight mt-0.5">
                              {nodeImpl.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-border shrink-0">
        <p className="text-[10px] text-text-muted text-center">
          Click or drag to add nodes
        </p>
      </div>
    </div>
  );
}
