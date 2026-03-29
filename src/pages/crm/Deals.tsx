import { Search, Filter, MoreHorizontal, Calendar, Plus, LayoutGrid, List, Users, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDeals, updateDeal } from '../../lib/api';
import DealSlideOver from '../../components/crm/DealSlideOver';
import { SmartTable, Column, TableGroup } from '../../components/crm/SmartTable';
import DealDetailDrawer from '../../components/crm/DealDetailDrawer';

interface Deal {
  id: string;
  title: string;
  companyId?: string;
  contactId?: string;
  company?: {
    name: string;
  };
  amount: number | string;
  stage: string;
  closeDate?: string;
  priority?: 'low' | 'medium' | 'high';
  owner?: string;
  tags?: string[];
}

export default function Deals() {
  const navigate = useNavigate();
  const stages = [
    { id: 'lead', name: 'Lead', color: 'bg-slate-400' },
    { id: 'qualified', name: 'Qualified', color: 'bg-blue-400' },
    { id: 'proposal', name: 'Proposal', color: 'bg-amber' },
    { id: 'negotiation', name: 'Negotiation', color: 'bg-purple' },
    { id: 'won', name: 'Won', color: 'bg-green' },
  ];

  const queryClient = useQueryClient();
  const [optimisticDeals, setOptimisticDeals] = useState<Deal[] | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'table'>('table');

  const { data: serverDeals = [], isLoading: loading } = useQuery<Deal[]>({
    queryKey: ['deals'],
    queryFn: getDeals
  });

  const deals = optimisticDeals !== null ? optimisticDeals : serverDeals;

  const updateStageMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; stage: string }) => updateDeal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setOptimisticDeals(null);
    },
    onError: () => {
      // Revert optimistic update
      setOptimisticDeals(null);
    }
  });

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const draggedDeal = deals.find(d => d.id === draggableId);
    if (!draggedDeal) return;

    // Create a new array to avoid mutating state directly
    const newDeals = [...deals];
    
    // Remove the dragged item from its original position
    const sourceIndex = newDeals.findIndex(d => d.id === draggableId);
    newDeals.splice(sourceIndex, 1);

    // Update the stage of the dragged item
    const updatedDeal = { ...draggedDeal, stage: destination.droppableId };

    // Find where to insert it in the destination stage
    // We need to insert it at the correct index relative to other items in the destination stage
    const destStageDeals = newDeals.filter(d => d.stage === destination.droppableId);
    
    // If inserting at the end or into an empty list
    if (destination.index >= destStageDeals.length) {
      newDeals.push(updatedDeal);
    } else {
      // Find the actual index in the full array
      const itemAtDestIndex = destStageDeals[destination.index];
      const actualInsertIndex = newDeals.findIndex(d => d.id === itemAtDestIndex.id);
      newDeals.splice(actualInsertIndex, 0, updatedDeal);
    }

    setOptimisticDeals(newDeals);

    // Update backend via mutation
    updateStageMutation.mutate({
      id: updatedDeal.id,
      stage: destination.droppableId
    });
  };

  // SmartTable Configurations
  const tableColumns: Column<Deal>[] = [
    { 
      key: 'title', 
      header: 'Deal Name', 
      width: '25%',
      render: (deal) => <div className="font-medium text-text-main group-hover/row:text-primary transition-colors">{deal.title}</div>
    },
    {
      key: 'stage',
      header: 'Stage',
      align: 'center',
      width: '140px',
      render: (deal) => {
         const stageData = stages.find(s => s.id === deal.stage);
         return (
           <div className={`w-full py-1.5 text-xs font-semibold text-center text-white rounded shadow-sm ${stageData?.color.replace('bg-', 'bg-') || 'bg-surface'}`}>
             {stageData?.name || deal.stage}
           </div>
         );
      }
    },
    {
       key: 'owner',
       header: 'Owner',
       align: 'center',
       width: '80px',
       render: (deal) => (
         deal.owner ? (
         <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold border border-primary/30 mx-auto" title={deal.owner}>
           {deal.owner}
         </div>
         ) : <div className="w-7 h-7 rounded-full bg-surface border border-dashed border-border flex items-center justify-center mx-auto text-text-muted hover:border-primary/50 transition-colors cursor-pointer"><Plus className="w-3 h-3"/></div>
       )
    },
    {
      key: 'amount',
      header: 'Deal Value',
      align: 'right',
      width: '120px',
      render: (deal) => <div className="font-mono text-sm">${(deal.amount || 0).toLocaleString()}</div>
    },
    {
       key: 'contact',
       header: 'Contacts',
       align: 'center',
       width: '150px',
       render: (deal) => (
         <div className="flex items-center justify-center mx-auto gap-2 bg-surface border border-border px-3 py-1 rounded-full text-xs font-medium text-text-muted w-max hover:border-primary/50 transition-colors cursor-pointer">
           <Users className="w-3 h-3" />
           {deal.contactId ? 'Contact Attached' : 'Add Contact'}
         </div>
       )
    },
    {
       key: 'company',
       header: 'Accounts',
       align: 'center',
       width: '150px',
       render: (deal) => (
         <div className="flex items-center justify-center mx-auto gap-2 bg-surface border border-border px-3 py-1 rounded-full text-xs font-medium text-text-muted w-max hover:border-primary/50 transition-colors cursor-pointer">
           <Building2 className="w-3 h-3" />
           {deal.company?.name || 'Add Account'}
         </div>
       )
    }
  ];

  const activeDeals = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost');
  const wonDeals = deals.filter(d => d.stage === 'won');

  const tableGroups: TableGroup<Deal>[] = [
    {
      id: 'active',
      title: 'Active Deals',
      color: 'bg-blue-500',
      items: activeDeals,
      summary: (
        <div className="flex items-center justify-end w-full pr-[330px]">
          <span className="text-text-muted text-sm mr-4">Total Value</span>
          <span className="font-mono font-medium">${activeDeals.reduce((sum, d) => sum + (d.amount || 0), 0).toLocaleString()}</span>
        </div>
      )
    },
    {
      id: 'won',
      title: 'Closed Won',
      color: 'bg-green-500',
      items: wonDeals,
      summary: (
        <div className="flex items-center justify-end w-full pr-[330px]">
          <span className="text-text-muted text-sm mr-4">Total Won</span>
          <span className="font-mono font-medium">${wonDeals.reduce((sum, d) => sum + (d.amount || 0), 0).toLocaleString()}</span>
        </div>
      )
    }
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-border bg-surface shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deals Pipeline</h1>
          <p className="text-sm text-text-muted mt-1">Manage your sales opportunities and forecast.</p>
        </div>
        <button 
          onClick={() => setIsSlideOverOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white shadow-md shadow-primary/20 rounded-lg font-medium hover:bg-primary-hover transition-all"
        >
          <Plus className="w-4 h-4" />
          New Deal
        </button>
      </header>

      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-bg shrink-0">
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search deals..." 
            className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-surface border border-border rounded-lg mr-2">
            <button 
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text-main'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'board' ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text-main'}`}
              title="Board View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors">
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 overflow-auto ${viewMode === 'board' ? 'p-6' : 'p-8'}`}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted">Loading deals...</div>
        ) : viewMode === 'table' ? (
          <main className="max-w-[1400px]">
            <SmartTable 
              columns={tableColumns} 
              groups={tableGroups} 
              onRowClick={(d) => setSelectedDealId(d.id)}
              onAddClick={() => setIsSlideOverOpen(true)}
              addLabel="+ Add deal"
            />
          </main>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-6 h-full min-w-max">
              {stages.map(stage => {
                const stageDeals = deals.filter(d => d.stage.toLowerCase() === stage.id.toLowerCase());
                const totalAmount = stageDeals.reduce((sum, deal) => {
                  const num = typeof deal.amount === 'string' ? parseInt(deal.amount.replace(/[^0-9]/g, '') || '0', 10) : deal.amount;
                  return sum + (num || 0);
                }, 0);

                return (
                  <div key={stage.id} className="w-80 flex flex-col h-full">
                    {/* Stage Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                        <h3 className="font-semibold">{stage.name}</h3>
                        <span className="text-xs font-medium text-text-muted bg-surface border border-border px-2 py-0.5 rounded-full">
                          {stageDeals.length}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-text-muted">
                        ${totalAmount.toLocaleString()}
                      </div>
                    </div>

                    {/* Deal Cards */}
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 flex flex-col gap-3 rounded-xl p-3 border overflow-y-auto transition-colors ${
                            snapshot.isDraggingOver ? 'bg-surface border-primary/50' : 'bg-surface/50 border-border/50'
                          }`}
                        >
                          {stageDeals.map((deal, index) => (
                            <Draggable key={deal.id} draggableId={deal.id} index={index}>
                              {(provided, snapshot) => (
                                <div 
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => setSelectedDealId(deal.id)}
                                  className={`bg-surface border rounded-xl p-4 cursor-pointer transition-all shadow-sm group relative overflow-hidden ${
                                    snapshot.isDragging ? 'border-primary shadow-xl ring-2 ring-primary/20 scale-105 z-50' : 'border-border hover:border-primary/50 hover:shadow-md'
                                  }`}
                                  style={{
                                    ...provided.draggableProps.style,
                                    transform: snapshot.isDragging 
                                      ? `${provided.draggableProps.style?.transform} rotate(3deg)` 
                                      : provided.draggableProps.style?.transform
                                  }}
                                >
                                  {/* Priority indicator stripe */}
                                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                    deal.priority === 'high' ? 'bg-red-500' :
                                    deal.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                                  }`} />

                                  <div className="flex items-start justify-between mb-3 pl-2">
                                    <div className="font-semibold text-sm text-text-main group-hover:text-primary transition-colors pr-4">{deal.title}</div>
                                    <button 
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-text-muted hover:text-text-main opacity-0 group-hover:opacity-100 transition-opacity p-1 -mr-2 -mt-2 rounded-md hover:bg-surface-hover"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-2 mb-4 pl-2">
                                    <div className="w-5 h-5 rounded bg-bg border border-border flex items-center justify-center text-[10px] font-bold text-text-muted uppercase shrink-0">
                                      {(deal.company?.name || 'N').substring(0, 1)}
                                    </div>
                                    <div className="text-xs font-medium text-text-muted truncate">{deal.company?.name || 'No Company'}</div>
                                  </div>

                                  {/* Tags */}
                                  {deal.tags && deal.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-4 pl-2">
                                      {deal.tags.map(tag => (
                                        <span key={tag} className="text-[10px] font-medium bg-bg text-text-muted px-2 py-0.5 rounded-md border border-border">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50 pl-2">
                                    <div className="font-bold text-sm text-text-main">
                                      {typeof deal.amount === 'number' ? `$${deal.amount.toLocaleString()}` : deal.amount}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
                                        <Calendar className="w-3 h-3" />
                                        {deal.closeDate}
                                      </div>
                                      {deal.owner && (
                                        <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold border border-primary/20" title={`Owner: ${deal.owner}`}>
                                          {deal.owner}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {stageDeals.length === 0 && !snapshot.isDraggingOver && (
                            <div className="h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-sm text-text-muted">
                              Drop deals here
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </div>

      <DealSlideOver 
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
      />
      
      <DealDetailDrawer
        isOpen={!!selectedDealId}
        onClose={() => setSelectedDealId(null)}
        dealId={selectedDealId}
      />
    </div>
  );
}
