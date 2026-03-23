import React, { useState } from 'react';
import { 
  FileText, LayoutGrid, Plus, Search, MoreHorizontal, 
  Settings, FolderOpen, Calendar, Users, Tags 
} from 'lucide-react';

export default function Projects() {
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const mockProjects = [
    { id: '1', title: 'Q4 Product Launch', description: 'GTM strategy, email sequences, and ad assets.', type: 'Marketing', users: 3, lastEdited: '2h ago', color: 'bg-blue-500' },
    { id: '2', title: 'Q3 Financial Review', description: 'Revenue tracking, SaaS metrics, and projections.', type: 'Finance', users: 2, lastEdited: '1d ago', color: 'bg-emerald-500' },
    { id: '3', title: 'Enterprise Sales Deck', description: 'Master presentation for Acme Corp negotiation.', type: 'Sales', users: 5, lastEdited: '3d ago', color: 'bg-amber-500' },
    { id: '4', title: 'Stone AIO Rebrand', description: 'Asset library, UX copies, and design tokens.', type: 'Design', users: 4, lastEdited: 'Just now', color: 'bg-purple-500' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-bg font-sans overflow-hidden">
      
      {/* Header */}
      <header className="px-8 py-6 border-b border-border bg-surface shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-main tracking-tight">Projects Workspace</h1>
            <p className="text-sm text-text-muted mt-1">Notion-like documents and team knowledge base.</p>
          </div>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-all shadow-md">
            <Plus className="w-5 h-5" />
            New Project
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex bg-surface p-1 rounded-lg border border-border">
            <button 
              onClick={() => setView('grid')}
              className={`px-3 py-1.5 rounded-md transition-colors ${view === 'grid' ? 'bg-bg text-primary shadow-sm border border-border' : 'text-text-muted hover:text-text-main'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-bg text-primary shadow-sm border border-border' : 'text-text-muted hover:text-text-main'}`}
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search projects..." 
              className="w-64 pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary text-text-main"
            />
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mockProjects.map(project => (
            <div key={project.id} className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
              <div className="h-32 bg-surface-hover border-b border-border relative overflow-hidden" style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '12px 12px' }}>
                <div className={`absolute top-4 left-4 w-10 h-10 rounded-xl ${project.color} text-white flex items-center justify-center shadow-lg shadow-black/10 group-hover:scale-110 transition-transform`}>
                  <FolderOpen className="w-5 h-5" />
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-text-main group-hover:text-primary transition-colors">{project.title}</h3>
                  <button className="text-text-muted hover:text-text-main opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-text-muted line-clamp-2 mb-4">{project.description}</p>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg border border-border text-[10px] font-medium text-text-muted">
                    <Tags className="w-3 h-3" />
                    {project.type}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-text-muted">
                    <Calendar className="w-3 h-3" />
                    {project.lastEdited}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {/* Create New Block */}
          <div className="bg-bg border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center p-8 cursor-pointer hover:border-primary/50 hover:bg-surface-hover transition-colors text-text-muted hover:text-primary group min-h-[240px]">
            <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center mb-3 group-hover:bg-primary/10 transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-medium text-sm">Create New Project</span>
          </div>
        </div>

      </div>
    </div>
  );
}
