import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Search, Filter, Share2, MoreHorizontal, MessageSquare, Link, Users, Plus, Grid, Zap } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function MondayHeader({ title, subtitle = "Main table" }: { title: string, subtitle?: string }) {
  return (
    <div className="flex flex-col pt-6 pb-2 px-8 bg-bg/80 backdrop-blur-xl shrink-0 border-b border-border z-10 sticky top-0 shadow-sm transition-all duration-300">
      <div className="flex items-center gap-2 text-2xl font-bold text-text-main mb-4">
         {title} <ChevronDown className="w-5 h-5 text-text-muted cursor-pointer hover:text-primary transition-colors" />
      </div>
      
      {/* Board Views Bar */}
      <div className="flex items-center gap-6 text-[14px] font-semibold text-text-muted">
         <div className="flex items-center gap-2 pb-2.5 border-b-[3px] border-primary text-primary cursor-pointer shadow-[0_1px_0_var(--primary)] drop-shadow-sm">
           <Grid className="w-4 h-4" /> {subtitle} <MoreHorizontal className="w-4 h-4 opacity-50" />
         </div>
         <div className="flex items-center pb-2.5 cursor-pointer hover:text-text-main transition-colors text-text-muted">
           <Plus className="w-4 h-4" /> New View
         </div>
      </div>
    </div>
  );
}

export function MondayToolbar({ actionButtonText = "New item", onAdd }: { actionButtonText?: string, onAdd?: () => void }) {
  return (
    <div className="flex items-center gap-5 px-8 py-4 bg-surface shrink-0 border-b border-border">
      <div className="flex shadow-luxury rounded-lg">
        <button className="bg-primary hover:bg-primary-hover text-white text-[13px] font-bold px-5 py-2 rounded-l-lg transition-all" onClick={onAdd}>
          {actionButtonText}
        </button>
        <button className="bg-primary hover:bg-primary-hover text-white px-2.5 py-2 rounded-r-lg border-l border-white/20 transition-all flex items-center justify-center">
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 text-[13px] text-text-muted font-bold ml-2">
        <div className="flex items-center gap-2 cursor-pointer hover:text-text-main hover:bg-surface-hover transition-all px-3 py-1.5 rounded-lg border border-transparent hover:border-border/50">
          <Search className="w-4 h-4" /> Search
        </div>
        <div className="flex items-center gap-2 cursor-pointer hover:text-text-main hover:bg-surface-hover transition-all px-3 py-1.5 rounded-lg border border-transparent hover:border-border/50">
          <Users className="w-4 h-4" /> Person
        </div>
        <div className="flex items-center gap-2 cursor-pointer hover:text-text-main hover:bg-surface-hover transition-all px-3 py-1.5 rounded-lg border border-transparent hover:border-border/50">
          <Filter className="w-4 h-4" /> Filter <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </div>
        <div className="flex items-center gap-2 cursor-pointer hover:text-text-main hover:bg-surface-hover transition-all px-3 py-1.5 rounded-lg border border-transparent hover:border-border/50">
          <MoreHorizontal className="w-4 h-4" /> Group by <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </div>
      </div>
    </div>
  );
}

export function MondayGroup({ title, color, children, isCollapsed, onToggle, onEdit, onDelete }: { title: string, color: string, children: React.ReactNode, isCollapsed?: boolean, onToggle?: () => void, onEdit?: () => void, onDelete?: () => void, key?: React.Key }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  return (
    <div className="mb-10 w-full overflow-x-auto px-8 stagger-children">
      <div className="flex items-center gap-2 mb-3 relative group w-max">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onToggle}>
          <ChevronDown className={cn("w-5 h-5 transition-transform", color, isCollapsed && "-rotate-90")} />
          <h3 className={cn("text-lg font-bold group-hover:underline drop-shadow-sm", color)}>{title}</h3>
        </div>
        {(onEdit || onDelete) && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-main"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-full top-0 ml-2 z-50 bg-white/95 border border-border rounded-xl shadow-luxury py-1 min-w-[140px]">
                  {onEdit && (
                    <button onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-[12px] font-semibold text-text-main hover:bg-surface-hover hover:text-primary transition-colors flex items-center gap-2">
                      Edit Group
                    </button>
                  )}
                  {onDelete && (
                    <button onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-[12px] font-semibold text-accent-red hover:bg-red/5 transition-colors flex items-center gap-2">
                      Delete Group
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {!isCollapsed && (
         <div className="min-w-full min-w-[1000px] w-max rounded-xl overflow-hidden glass-panel border border-border shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
           {children}
         </div>
      )}
    </div>
  );
}

export function MondayHeaderRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex border-b border-border bg-surface-hover/80 backdrop-blur-md sticky top-0 z-20 transition-colors">
      <div className="border-r border-border bg-transparent flex items-center justify-center p-2.5 w-[50px] shrink-0 sticky left-0 z-30">
        <div className="w-4 h-4 border-2 border-border rounded-md cursor-pointer hover:border-primary transition-colors" />
      </div>
      {children}
    </div>
  );
}

export function MondayHeaderCell({ children, width = "w-[180px]", className }: { children: React.ReactNode, width?: string, className?: string }) {
  return (
    <div className={cn("border-r border-border flex items-center p-3 text-[12px] uppercase tracking-wider font-bold text-text-muted bg-transparent hover:bg-surface-hover cursor-col-resize shrink-0 transition-colors", width, className)}>
      <span className="truncate">{children}</span>
    </div>
  );
}

export function MondayRow({ children, groupColorClass, isBottomAddLayout = false }: { children: React.ReactNode, groupColorClass: string, isBottomAddLayout?: boolean, key?: React.Key }) {
  return (
    <div className={cn("flex border-b border-border bg-surface hover:bg-surface-hover transition-colors group relative", isBottomAddLayout ? "text-text-muted opacity-80 bg-bg" : "")}>
      <div className={cn("border-r border-border bg-surface group-hover:bg-surface-hover flex items-center justify-center p-2.5 w-[50px] shrink-0 sticky left-0 z-10 transition-colors")}>
        <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 transition-transform group-hover:scale-x-150 origin-left", groupColorClass)} />
        {!isBottomAddLayout && <div className="w-4 h-4 border-2 border-border rounded-md opacity-40 group-hover:opacity-100 hover:border-primary cursor-pointer transition-all bg-surface" />}
      </div>
      {children}
    </div>
  );
}

export function MondayCell({ children, width = "w-[180px]", className, isStatusPill = false, statusColor }: { children?: React.ReactNode, width?: string, className?: string, isStatusPill?: boolean, statusColor?: string }) {
  if (isStatusPill && statusColor) {
     return (
       <div className={cn("border-r border-border shrink-0 relative overflow-hidden transition-all text-white font-bold text-[13px] text-center flex items-center justify-center cursor-pointer hover:brightness-110", width, className)}>
         <div className="absolute inset-0 opacity-80 transition-opacity hover:opacity-100" style={{ backgroundColor: statusColor }} />
         <div className="relative z-10 px-2 drop-shadow-md">{children}</div>
       </div>
     );
  }

  return (
    <div className={cn("border-r border-border flex items-center p-3 text-[13px] font-medium text-text-main shrink-0 cursor-cell outline-none focus-within:bg-bg focus-within:ring-2 focus-within:ring-primary focus-within:ring-inset bg-transparent transition-colors relative", className, width)}>
      {children}
    </div>
  );
}

export function StatusPill({ color, label }: { color: string, label: string }) {
  return <span className="truncate w-full">{label}</span>;
}

export function MondayAddBlock({ onClick }: { onClick?: () => void }) {
  return (
    <div className="px-8 mt-4 mb-8 flex-1">
      <button className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-border bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main hover:border-primary/50 rounded-xl text-[14px] transition-all shadow-sm font-bold" onClick={onClick}>
        <Plus className="w-4 h-4" /> Add new group
      </button>
    </div>
  );
}

export function LeadScoreBar({ score }: { score: number }) {
  let colorClass = 'bg-border';
  let textClass = 'text-text-muted';
  if (score >= 80) { colorClass = 'bg-green glow-green/30'; textClass = 'text-green'; }
  else if (score >= 50) { colorClass = 'bg-amber glow-amber/30'; textClass = 'text-amber'; }
  else if (score >= 30) { colorClass = 'bg-accent-red'; textClass = 'text-accent-red'; }
  else { colorClass = 'bg-border'; textClass = 'text-text-muted'; }

  return (
    <div className="flex items-center gap-3 w-full px-3">
       <span className={cn("text-[13px] font-bold w-7 text-right", textClass)}>
         {score}
       </span>
       <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden shadow-inner">
         <div className={cn("h-full rounded-full transition-all duration-500", colorClass)} style={{ width: `${score}%` }} />
       </div>
    </div>
  );
}

export function TagsCell({ tags }: { tags: { label: string, color?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 w-full px-1.5 justify-center max-h-[36px] overflow-hidden">
      {tags.map((t, i) => (
        <span key={i} className="px-2 py-0.5 rounded-md text-[11px] font-bold text-white whitespace-nowrap shadow-sm hover:scale-105 transition-transform" style={{ backgroundColor: t.color || 'var(--accent-purple)' }}>
          {t.label}
        </span>
      ))}
      {tags.length === 0 && <span className="text-text-muted italic text-[12px] opacity-70">—</span>}
    </div>
  );
}

export function MondayTable({ children }: { children?: React.ReactNode }) {
  return <div className="w-full flex-1 overflow-auto">{children}</div>;
}
