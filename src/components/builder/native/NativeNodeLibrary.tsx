import { useState, useEffect } from 'react';
import { Search, Zap, Command, GitBranch, Database, LayoutTemplate, MessageSquare, Bot, Box } from 'lucide-react';
import { apiClient } from '../../../lib/apiClient';

const CATEGORY_COLORS: Record<string, string> = {
  trigger: 'bg-amber-500',
  logic: 'bg-purple-500',
  crm: 'bg-green-500',
  communication: 'bg-cyan-500',
  ai: 'bg-orange-500',
  data: 'bg-blue-500',
};

const CATEGORY_ICONS: Record<string, any> = {
  trigger: Zap,
  logic: GitBranch,
  crm: LayoutTemplate,
  communication: MessageSquare,
  ai: Bot,
  data: Database,
};

export function NativeNodeLibrary({ onAddNode }: { onAddNode: (nodeImpl: any) => void }) {
  const [search, setSearch] = useState('');
  const [catalog, setCatalog] = useState<{ category: string, nodes: any[] }[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/api/workflows/nodes/catalog')
      .then(res => setCatalog(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const onDragStart = (event: React.DragEvent, nodeImpl: any) => {
    event.dataTransfer.setData('application/reactflow-native-node', JSON.stringify(nodeImpl));
    event.dataTransfer.effectAllowed = 'move';
  };

  const categories = ['All', ...catalog.map(c => c.category)];
  
  const filteredCatalog = catalog.map(group => ({
    ...group,
    nodes: group.nodes.filter(n => n.displayName.toLowerCase().includes(search.toLowerCase()))
  })).filter(group => group.nodes.length > 0 && (activeCategory === 'All' || group.category === activeCategory));

  return (
    <div className="w-80 border-r border-border bg-surface flex flex-col h-full z-10 shrink-0">
      <div className="p-4 border-b border-border space-y-4">
        <h2 className="text-sm font-semibold text-text-main">Native Nodes</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg border border-border rounded-lg text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        
        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat ? 'bg-primary text-white' : 'bg-bg text-text-muted hover:text-text-main'
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoading ? (
          <div className="text-center text-sm text-text-muted py-8">Loading catalog...</div>
        ) : filteredCatalog.length === 0 ? (
          <div className="text-center text-sm text-text-muted py-8">No nodes found</div>
        ) : (
          filteredCatalog.map(group => (
            <div key={group.category} className="space-y-3">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
                {CATEGORY_ICONS[group.category] ? (() => {
                  const Icon = CATEGORY_ICONS[group.category];
                  return <Icon className="w-3.5 h-3.5" />;
                })() : <Box className="w-3.5 h-3.5" />}
                {group.category}
              </h3>
              <div className="grid gap-2">
                {group.nodes.map(nodeImpl => (
                  <div
                    key={nodeImpl.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, nodeImpl)}
                    onClick={() => onAddNode(nodeImpl)}
                    className="group flex items-start gap-3 p-3 bg-bg border border-border hover:border-primary rounded-xl cursor-grab active:cursor-grabbing transition-colors"
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white"
                      style={{ backgroundColor: nodeImpl.color || CATEGORY_COLORS[group.category] || '#52677D' }}
                    >
                      {nodeImpl.type.startsWith('trigger.') ? <Zap className="w-4 h-4" /> : <Command className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-main truncate group-hover:text-primary transition-colors">
                        {nodeImpl.displayName}
                      </p>
                      <p className="text-xs text-text-muted truncate mt-0.5">
                        {nodeImpl.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
