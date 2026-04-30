import React from 'react';
import { WORKFLOW_NODES } from '../../data/workflowNodes';

export default function NodeLibrary() {
  return (
    <aside className="w-80 border-l border-border/50 bg-surface/40 backdrop-blur-xl flex flex-col shrink-0 z-10 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)]">
      <div className="flex flex-col h-full animate-in fade-in duration-200">
        <div className="p-4 border-b border-border bg-bg/50">
          <h2 className="font-semibold text-sm mb-3">Node Library</h2>
          <input 
            type="text" 
            placeholder="Search nodes..." 
            className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-6 pb-20">
            {['Triggers', 'AI & Logic', 'Data & CRM', 'Communication', 'Integrations'].map((category) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">{category}</h3>
                <div className="space-y-2">
                  {WORKFLOW_NODES.filter(n => n.category === category).map(node => (
                    <div 
                      key={node.id}
                      draggable 
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/reactflow', JSON.stringify({ id: node.id, name: node.name }));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className={`flex items-center gap-3 p-2 rounded-md border border-border bg-bg cursor-grab transition-colors ${node.borderClass}`}
                    >
                      <div className={`p-1.5 rounded ${node.bgClass} ${node.colorClass}`}>
                        {(() => {
                          const Icon = node.icon;
                          return <Icon className="w-4 h-4" />;
                        })()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium block">{node.name}</span>
                        <span className="text-[10px] text-text-muted block truncate">{node.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
