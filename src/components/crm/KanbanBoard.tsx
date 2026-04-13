import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Users, Building2, MoreHorizontal, Plus, Clock, Target, Calendar, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface KanbanDeal {
  id: string;
  title: string;
  value: number;
  stage: string;
  probability: number;
  expectedCloseDate?: string;
  stageAge?: number;
  rottingDays?: number;
  contact?: { firstName: string; lastName?: string | null } | null;
  company?: { name: string } | null;
}

interface KanbanBoardProps {
  deals: KanbanDeal[];
  stages: { id: string; name: string; color: string; rottingDays?: number }[];
  onDealMove: (dealId: string, destStageName: string) => void;
  onDealDelete?: (dealId: string) => void;
  onDealEdit?: (dealId: string) => void;
}

function ProbabilityBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-hover rounded-full overflow-hidden shadow-inner">
        <motion.div className="h-full rounded-full" style={{ background: color, color: color }} initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.5 }} />
      </div>
      <span className="text-[11px] font-bold text-text-muted w-8 text-right">{value}%</span>
    </div>
  );
}

function DealCard({ deal, index, stageColor, rottingDays, onEdit, onDelete }: {
  deal: KanbanDeal; index: number; stageColor: string; rottingDays?: number;
  onEdit?: () => void; onDelete?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isRotting = rottingDays && (deal.stageAge || 0) > rottingDays;
  const initials = `${deal.contact?.firstName?.[0] || ''}`.toUpperCase();

  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          onClick={onEdit}
          className={`group transition-all select-none rounded-xl border ${
            snapshot.isDragging ? 'shadow-2xl border-primary/40 rotate-1 z-50 scale-105 cursor-grabbing bg-white' : 'bg-surface border-border shadow-sm hover:shadow-md cursor-pointer hover:border-primary/50'
          }`}
        >
          <div className="p-3 relative flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-text-main text-[13px] leading-snug pr-2 group-hover:text-primary transition-colors line-clamp-2">{deal.title}</h4>
              <div className="relative shrink-0 -mt-1 -mr-1">
                <button onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
                  className="text-text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-lg hover:bg-surface-hover">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute top-6 right-0 z-50 bg-surface border border-border rounded-xl shadow-xl py-1 min-w-[130px]"
                      onClick={e => e.stopPropagation()}>
                      {onEdit && <button onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-[12px] font-semibold text-text-main hover:bg-surface-hover hover:text-primary flex items-center gap-2 transition-colors"><Pencil className="w-3.5 h-3.5" /> Edit deal</button>}
                      {onDelete && <button onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-[12px] font-semibold text-accent-red hover:bg-red/10 flex items-center gap-2 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-[15px] font-bold text-text-main leading-none">
                ${(deal.value || 0).toLocaleString()}
              </div>
              {deal.expectedCloseDate && (
                <div className="text-[10px] font-bold text-text-muted flex items-center gap-1 bg-surface-hover px-1.5 py-0.5 rounded shadow-sm">
                  <Calendar className="w-3 h-3 text-primary/70" /> {deal.expectedCloseDate}
                </div>
              )}
            </div>

            <ProbabilityBar value={deal.probability} color={stageColor} />

            {(deal.contact || deal.company || deal.stageAge !== undefined) && (
              <div className="flex items-center gap-1.5 mt-0.5 pt-2 border-t border-border/60">
                {deal.contact && (
                  <div className="flex items-center gap-1 bg-surface-hover px-1.5 py-0.5 rounded shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-[10px] font-bold text-text-muted max-w-[90px]">
                    <Users className="w-3 h-3 shrink-0 text-accent-teal" />
                    <span className="truncate">{deal.contact.firstName}</span>
                  </div>
                )}
                {deal.company && (
                  <div className="flex items-center gap-1 bg-primary/[0.04] px-1.5 py-0.5 rounded shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-[10px] font-bold text-primary/80 max-w-[90px]">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{deal.company.name}</span>
                  </div>
                )}
                {deal.stageAge !== undefined && (
                  <div className={`ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-[10px] font-bold ${isRotting ? 'bg-red/10 text-accent-red' : 'bg-surface-hover text-text-muted'}`}>
                    <Clock className={`w-3 h-3 ${isRotting ? 'text-accent-red' : 'text-primary/70'}`} /> {deal.stageAge}d
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

export default function KanbanBoard({ deals, stages, onDealMove, onDealDelete, onDealEdit }: KanbanBoardProps) {
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;
    onDealMove(draggableId, destination.droppableId);
  };

  const getStageHex = (color: string) => {
    const map: Record<string, string> = {
      'text-[#579bfc]': 'var(--primary)', 'text-[#00cff4]': 'var(--accent-teal)',
      'text-[#a25ddc]': 'var(--accent-purple)', 'text-[#00c875]': 'var(--accent-green)', 'text-[#e2445c]': 'var(--accent-red)',
    };
    return map[color] || 'var(--text-muted)';
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full w-full overflow-x-auto px-6 py-4 gap-6 bg-bg styled-scrollbar relative">
        {stages.map(stage => {
          const hex = getStageHex(stage.color);
          const columnDeals = deals.filter(d => d.stage === stage.name);
          const total = columnDeals.reduce((acc, d) => acc + d.value, 0);
          const weighted = columnDeals.reduce((acc, d) => acc + d.value * (d.probability / 100), 0);

          return (
            <div key={stage.id} className="flex flex-col w-[310px] shrink-0 h-full relative z-10 glass-panel border border-border/50 shadow-none bg-surface/50 hover:bg-surface transition-colors rounded-2xl overflow-hidden p-2">
              {/* Column Header */}
              <div className="mb-4 px-3 pt-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: hex }} />
                    <h3 className="font-bold text-text-main text-[14px] uppercase tracking-wider">{stage.name}</h3>
                    <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: hex }}>
                      {columnDeals.length}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[12px] bg-bg/50 px-3 py-1.5 rounded-lg border border-border/50">
                  <span className="font-bold text-text-main">${total.toLocaleString()}</span>
                  <div className="flex items-center gap-1.5 text-text-muted">
                    <Target className="w-3.5 h-3.5" style={{ color: hex }} />
                    <span className="font-bold">${Math.round(weighted).toLocaleString()} wtd</span>
                  </div>
                </div>
                {/* Stage progress bar */}
                <div className="h-1 w-full bg-border/40 rounded-full mt-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ background: hex, color: hex, width: columnDeals.length > 0 ? '100%' : '0%' }} />
                </div>
              </div>

              {/* Droppable */}
              <Droppable droppableId={stage.name}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 flex flex-col gap-3 rounded-xl p-2 transition-colors overflow-y-auto w-full ${snapshot.isDraggingOver ? 'bg-primary/5 ring-1 ring-primary/20' : 'bg-transparent'}`}
                  >
                    {columnDeals.map((deal, index) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        index={index}
                        stageColor={hex}
                        rottingDays={stage.rottingDays}
                        onEdit={onDealEdit ? () => onDealEdit(deal.id) : undefined}
                        onDelete={onDealDelete ? () => onDealDelete(deal.id) : undefined}
                      />
                    ))}
                    {provided.placeholder}

                    {/* Add deal inline */}
                    <button className="w-full py-3 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface/50 text-[13px] font-bold text-text-muted hover:text-text-main hover:border-primary/50 hover:bg-surface-hover hover:shadow-sm transition-all mt-2">
                      <Plus className="w-4 h-4" /> Add deal
                    </button>
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}

        {/* Add stage placeholder */}
        <div className="w-[280px] shrink-0 bg-surface border-2 border-dashed border-border/70 rounded-2xl h-[80px] flex items-center justify-center text-text-muted font-semibold text-[14px] hover:bg-surface-hover hover:border-text-muted hover:text-text-main transition-all cursor-pointer mt-2 opacity-60 hover:opacity-100">
          <Plus className="w-5 h-5 mr-2" /> Add stage
        </div>
      </div>
    </DragDropContext>
  );
}
