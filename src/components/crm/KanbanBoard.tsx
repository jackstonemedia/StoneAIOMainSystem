import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Users, Building2, MoreHorizontal, Plus, Clock, Target, Calendar, Pencil, Trash2 } from 'lucide-react';
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
  onAddDeal?: (stageName: string) => void;
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

  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{ ...provided.draggableProps.style, borderLeftColor: stageColor }}
          onClick={onEdit}
          className={`group transition-all select-none rounded-xl border border-l-[3px] ${
            snapshot.isDragging 
              ? 'bg-surface/90 backdrop-blur-2xl ring-1 ring-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.4)] border-primary/50 rotate-2 z-50 scale-[1.02] cursor-grabbing' 
              : 'bg-surface/60 border-border/60 shadow-sm hover:shadow-md cursor-pointer hover:bg-surface'
          }`}
        >
          <div className="p-3.5 relative flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <h4 className="font-semibold text-primary text-[14px] leading-snug pr-2 hover:underline cursor-pointer line-clamp-2">{deal.title}</h4>
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

            <div className="flex flex-col gap-1">
              <div className="text-[12px] font-medium text-text-main">
                Amount: ${(deal.value || 0).toLocaleString()}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted mt-1">
                {deal.expectedCloseDate ? (
                  <><Calendar className="w-3 h-3" /> Task {deal.expectedCloseDate}</>
                ) : (
                  <>! No activity scheduled</>
                )}
              </div>
            </div>

            {(deal.contact || deal.company || deal.stageAge !== undefined) && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/40">
                {deal.contact && (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0" style={{ backgroundColor: stageColor }}>
                      {deal.contact.firstName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[12px] font-medium text-text-main truncate">
                      {deal.contact.firstName} {deal.contact.lastName || ''}
                    </span>
                  </div>
                )}
                {!deal.contact && deal.company && (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 text-[12px] font-medium text-text-main">
                    <Building2 className="w-3.5 h-3.5 shrink-0 text-primary/80" />
                    <span className="truncate">{deal.company.name}</span>
                  </div>
                )}
                {deal.stageAge !== undefined && (
                  <div className={`ml-auto shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold ${isRotting ? 'bg-red-400/10 text-red-400' : 'bg-surface-hover border border-border text-text-muted'}`}>
                    <Clock className={`w-3 h-3 ${isRotting ? 'text-red-400' : 'text-text-muted/70'}`} /> {deal.stageAge}d
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

export default function KanbanBoard({ deals, stages, onDealMove, onDealDelete, onDealEdit, onAddDeal }: KanbanBoardProps) {
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;
    onDealMove(draggableId, destination.droppableId);
  };

  const getStageHex = (color: string) => {
    if (color.includes('green') || color.includes('10B981')) return '#10B981';
    if (color.includes('red') || color.includes('rose') || color.includes('EF4444')) return '#EF4444';
    return 'var(--primary)';
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full w-full overflow-x-auto bg-transparent styled-scrollbar relative">
        {stages.map(stage => {
          const hex = getStageHex(stage.color);
          const columnDeals = deals.filter(d => d.stage === stage.name);
          const total = columnDeals.reduce((acc, d) => acc + d.value, 0);

          return (
            <div key={stage.id} className="flex-1 min-w-[280px] flex flex-col h-full relative z-10 border-r border-border/50 transition-colors last:border-r-0">
              {/* Column Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-surface/40 backdrop-blur-md border-b border-border/50">
                <h3 className="font-bold text-text-main text-[12px] uppercase tracking-wider">{stage.name}</h3>
                <span className="text-[12px] font-bold text-text-main">{columnDeals.length}</span>
              </div>

              <Droppable droppableId={stage.name}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 flex flex-col gap-3 rounded-xl p-2 transition-colors overflow-y-auto w-full ${
                      snapshot.isDraggingOver ? 'bg-surface ring-2 ring-inset' : 'bg-transparent'
                    }`}
                    style={snapshot.isDraggingOver ? { '--tw-ring-color': hex + '40' } as React.CSSProperties : undefined}
                  >
                    {columnDeals.length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex-1" />
                    )}
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
                    <button
                      onClick={() => onAddDeal?.(stage.name)}
                      className="w-full py-2 flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface/50 transition-all mt-auto shrink-0 border border-transparent hover:border-border/50"
                    >
                      <Plus className="w-4 h-4" /> Add deal
                    </button>
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
