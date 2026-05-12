// @ts-nocheck
import React from 'react';
import { Box, Blocks, Plug, Zap, MessageSquare, Database, Layout } from 'lucide-react';
import { usePieces } from '../../hooks/usePieces';
import { WORKFLOW_NODES } from '../../data/workflowNodes';
import type { APPiece } from '../../types/automation';

const CATEGORY_ICONS: Record<string, any> = {
  'AI': Zap,
  'Communication': MessageSquare,
  'CRM': Database,
  'Integrations': Plug,
  'CORE': Blocks,
  'DEFAULT': Box
};

export default function NodeLibrary() {
  const { data: pieces = [], isLoading } = usePieces();
  const [search, setSearch] = React.useState('');

  let piecesArray = Array.isArray(pieces) ? pieces : (pieces as any)?.data ?? [];

  // Fallback to static mock nodes if Activepieces engine is offline or empty
  if (!isLoading && piecesArray.length === 0) {
    piecesArray = WORKFLOW_NODES.map((n: any) => ({
      name: n.id,
      displayName: n.name,
      description: n.description,
      logoUrl: '',
      version: '1.0.0',
      categories: [n.category],
      actions: n.category !== 'Triggers' ? [{ name: 'action', displayName: 'Action', props: {} }] : [],
      triggers: n.category === 'Triggers' ? [{ name: 'trigger', displayName: 'Trigger', props: {} }] : []
    }));
  }

  const filteredPieces = piecesArray.filter((p: APPiece) => 
    !search || 
    p.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by primary category
  const categorized = filteredPieces.reduce((acc, piece) => {
    const cat = piece.categories?.[0] || 'Integrations';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(piece);
    return acc;
  }, {} as Record<string, APPiece[]>);

  const categories = Object.keys(categorized).sort();

  return (
    <aside className="w-80 border-l border-border/50 bg-surface/40 backdrop-blur-xl flex flex-col shrink-0 z-10 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)]">
      <div className="flex flex-col h-full animate-in fade-in duration-200">
        <div className="p-4 border-b border-border bg-bg/50">
          <h2 className="font-semibold text-sm mb-3">Node Library</h2>
          <input 
            type="text" 
            placeholder="Search nodes..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 text-text-muted">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
              <span className="text-xs">Loading pieces...</span>
            </div>
          ) : filteredPieces.length === 0 ? (
            <div className="text-center py-10 text-xs text-text-muted">No pieces found</div>
          ) : (
            <div className="space-y-6 pb-20">
              {categories.map((category) => {
                const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.DEFAULT;
                return (
                  <div key={category}>
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5" /> {category}
                    </h3>
                    <div className="space-y-2">
                      {categorized[category].map((piece: APPiece) => (
                        <div 
                          key={piece.name}
                          draggable 
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/reactflow', JSON.stringify({ 
                              id: piece.name, 
                              name: piece.displayName,
                              type: piece.name.includes('trigger') ? 'TRIGGER' : 'PIECE',
                              version: piece.version
                            }));
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          className={`flex items-center gap-3 p-2 rounded-md border border-border bg-bg cursor-grab transition-colors hover:border-primary/50 group`}
                        >
                          <div className="w-8 h-8 rounded border border-border/50 bg-surface flex items-center justify-center shrink-0">
                            {piece.logoUrl ? (
                              <img src={piece.logoUrl} alt="" className="w-5 h-5 object-contain" />
                            ) : (
                              <Box className="w-4 h-4 text-text-muted" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-text-main block truncate group-hover:text-primary transition-colors">{piece.displayName}</span>
                            <span className="text-[10px] text-text-muted block truncate">{piece.actions?.length || 0} Actions</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
