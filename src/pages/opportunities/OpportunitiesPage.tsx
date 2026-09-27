import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Plus, Search, Filter, ChevronDown, ChevronRight, MoreVertical, LayoutGrid, List as ListIcon,
  Upload, Download, Sliders, Layers, Tag as TagIcon, Settings,
  Bookmark, Check, ArrowUpDown, Trash2, Edit2, User, Building2, Clock, AlertTriangle,
  Sparkles, CheckSquare, Square, X, RefreshCw, Trophy, XCircle, ArrowRight, GripVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

import { opportunitiesApi } from '../../lib/api/opportunities';
import { useToast } from '../../components/ui/Toast';

// Modals & Drawers
import { CreateOpportunityModal } from './components/CreateOpportunityModal';
import { RequiredFieldsModal } from './components/RequiredFieldsModal';
import { WonLostReasonModal } from './components/WonLostReasonModal';
import { CustomizeCardModal } from './components/CustomizeCardModal';
import { ImportOpportunitiesModal } from './components/ImportOpportunitiesModal';
import { SavedViewsModal } from './components/SavedViewsModal';
import { FilterSlideOver } from './components/FilterSlideOver';

import type {
  Opportunity,
  Pipeline,
  Stage,
  CustomField,
  Tag,
  SavedView,
  CardConfig,
  ColumnConfig,
  FilterState
} from '../../types/opportunities';

const DEFAULT_CARD_CONFIG: CardConfig = {
  showContact: true,
  showValue: true,
  showTags: true,
  showOwner: true,
  showDaysInStage: true,
  showCustomFields: true,
  visibleCustomFieldIds: [],
};

const STAGE_COLOR_PALETTE = [
  '#818CF8', '#60A5FA', '#38BDF8', '#34D399', '#10B981',
  '#FBBF24', '#F59E0B', '#F472B6', '#EC4899', '#A78BFA',
  '#8B5CF6', '#94A3B8', '#F87171', '#EF4444',
];

export default function OpportunitiesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const { toast } = useToast();

  // ── Navigation / View States ──────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [activePipelineId, setActivePipelineId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filters State
  const [filters, setFilters] = useState<FilterState>({
    stages: [],
    owners: [],
    tags: [],
    sources: [],
    customFields: {},
  });

  // Card configuration
  const [cardConfig, setCardConfig] = useState<CardConfig>(DEFAULT_CARD_CONFIG);

  // Selection for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & Panels Visibility
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStageTargetId, setCreateStageTargetId] = useState<string | undefined>();
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSavedViewsModal, setShowSavedViewsModal] = useState(false);
  const [showCustomizeCardModal, setShowCustomizeCardModal] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showPipelineSwitcher, setShowPipelineSwitcher] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Stage transition prompt states
  const [requiredFieldsDeal, setRequiredFieldsDeal] = useState<Opportunity | null>(null);
  const [requiredFieldsTargetStage, setRequiredFieldsTargetStage] = useState<Stage | null>(null);
  const [wonLostPromptDeal, setWonLostPromptDeal] = useState<{ deal: Opportunity; type: 'won' | 'lost'; targetStage?: Stage } | null>(null);

  // Stage Creation / Editing state
  const [isAddingNewStage, setIsAddingNewStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#818CF8');
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [activeColorPickerStageId, setActiveColorPickerStageId] = useState<string | null>(null);
  const [collapsedStageIds, setCollapsedStageIds] = useState<string[]>([]);
  const [stageToDelete, setStageToDelete] = useState<Stage | null>(null);
  const [reassignmentStageId, setReassignmentStageId] = useState<string>('');
  const [dealToDelete, setDealToDelete] = useState<Opportunity | null>(null);

  // ── Data Fetching ────────────────────────────────────────────────────────────
  const { data: pipelines = [], isLoading: loadingPipelines } = useQuery<Pipeline[]>({
    queryKey: ['opportunities-pipelines'],
    queryFn: () => opportunitiesApi.listPipelines(),
  });

  // Active pipeline resolution
  const activePipeline = useMemo(() => {
    if (!pipelines.length) return null;
    if (activePipelineId) {
      const found = pipelines.find(p => p.id === activePipelineId);
      if (found) return found;
    }
    const def = pipelines.find(p => p.isDefault) || pipelines[0];
    return def;
  }, [pipelines, activePipelineId]);

  React.useEffect(() => {
    if (activePipeline && !activePipelineId) {
      setActivePipelineId(activePipeline.id);
    }
  }, [activePipeline, activePipelineId]);

  const stages = activePipeline?.stages || [];

  // Set default reassignment stage whenever stageToDelete is chosen
  React.useEffect(() => {
    if (stageToDelete) {
      const fallback = stages.find(s => s.id !== stageToDelete.id);
      setReassignmentStageId(fallback?.id || '');
    }
  }, [stageToDelete, stages]);

  // Query Opportunities
  const { data: oppsResponse, isLoading: loadingOpps } = useQuery({
    queryKey: [
      'opportunities',
      {
        pipelineId: activePipeline?.id,
        stages: filters.stages,
        owners: filters.owners,
        tags: filters.tags,
        sources: filters.sources,
        minValue: filters.minValue,
        maxValue: filters.maxValue,
        status: filters.status,
        createdStartDate: filters.createdStartDate,
        createdEndDate: filters.createdEndDate,
        closeStartDate: filters.closeStartDate,
        closeEndDate: filters.closeEndDate,
        search: searchQuery,
        sortBy,
        sortOrder,
      }
    ],
    queryFn: () => opportunitiesApi.list({
      pipelineId: activePipeline?.id,
      stageId: filters.stages.length === 1 ? filters.stages[0] : undefined,
      status: filters.status,
      ownerId: filters.owners.length > 0 ? filters.owners : undefined,
      tags: filters.tags.length > 0 ? filters.tags : undefined,
      source: filters.sources.length > 0 ? filters.sources : undefined,
      minValue: filters.minValue || undefined,
      maxValue: filters.maxValue || undefined,
      createdStartDate: filters.createdStartDate,
      createdEndDate: filters.createdEndDate,
      closeStartDate: filters.closeStartDate,
      closeEndDate: filters.closeEndDate,
      search: searchQuery || undefined,
      sortBy,
      sortOrder,
      limit: 500,
    }),
    enabled: Boolean(activePipeline?.id),
    placeholderData: (prev) => prev,
  });

  const opportunities: Opportunity[] = oppsResponse?.opportunities || [];
  const totalCount = oppsResponse?.total || 0;
  const summary = oppsResponse?.summary || { totalValue: 0, totalCount: 0, wonCount: 0, lostCount: 0 };

  const { data: customFields = [] } = useQuery<CustomField[]>({
    queryKey: ['opportunities-custom-fields', activePipeline?.id],
    queryFn: () => opportunitiesApi.listCustomFields(activePipeline?.id),
    enabled: Boolean(activePipeline?.id),
  });

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['opportunities-tags'],
    queryFn: () => opportunitiesApi.listTags(),
  });

  const { data: savedViews = [] } = useQuery<SavedView[]>({
    queryKey: ['opportunities-saved-views', activePipeline?.id],
    queryFn: () => opportunitiesApi.listSavedViews(activePipeline?.id),
    enabled: Boolean(activePipeline?.id),
  });

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.stages.length > 0) count++;
    if (filters.owners.length > 0) count++;
    if (filters.tags.length > 0) count++;
    if (filters.sources.length > 0) count++;
    if (filters.minValue || filters.maxValue) count++;
    if (filters.createdStartDate || filters.createdEndDate) count++;
    if (filters.closeStartDate || filters.closeEndDate) count++;
    if (filters.status) count++;
    return count;
  }, [filters]);

  // ── Stage Management Mutations ───────────────────────────────────────────────
  const createStageMut = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!activePipeline) throw new Error('No active pipeline');
      return opportunitiesApi.createStage(activePipeline.id, {
        name,
        color,
        probability: Math.min(100, (stages.length + 1) * 25),
        order: stages.length,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
      setIsAddingNewStage(false);
      setNewStageName('');
      toast('success', 'Stage created successfully');
    },
    onError: (err: any) => toast('error', 'Failed to create stage', err.message),
  });

  const updateStageMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Stage> }) => opportunitiesApi.updateStage(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
      setEditingStageId(null);
      setActiveColorPickerStageId(null);
      toast('success', 'Stage updated');
    },
    onError: (err: any) => toast('error', 'Failed to update stage', err.message),
  });

  const deleteStageMut = useMutation({
    mutationFn: async ({ id, reassignmentStageId }: { id: string; reassignmentStageId?: string }) => {
      return opportunitiesApi.deleteStage(id, reassignmentStageId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      setStageToDelete(null);
      toast('success', 'Stage deleted');
    },
    onError: (err: any) => toast('error', 'Failed to delete stage', err.message),
  });

  const deleteDealMut = useMutation({
    mutationFn: (id: string) => opportunitiesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      setDealToDelete(null);
      toast('success', 'Opportunity deleted');
    },
    onError: (err: any) => toast('error', 'Failed to delete opportunity', err.message),
  });

  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelinePreset, setNewPipelinePreset] = useState('sales');

  const createPipelineMut = useMutation({
    mutationFn: async () => {
      if (!newPipelineName.trim()) throw new Error('Pipeline name is required');
      return opportunitiesApi.createPipeline({
        name: newPipelineName.trim(),
        templatePreset: newPipelinePreset,
      });
    },
    onSuccess: (newPipeline) => {
      qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
      setActivePipelineId(newPipeline.id);
      setShowNewPipelineModal(false);
      setNewPipelineName('');
      toast('success', `Created "${newPipeline.name}" pipeline`);
    },
    onError: (err: any) => toast('error', 'Failed to create pipeline', err.message),
  });

  const handleCreateNewStage = () => {
    if (!newStageName.trim()) return;
    createStageMut.mutate({
      name: newStageName.trim(),
      color: newStageColor || STAGE_COLOR_PALETTE[stages.length % STAGE_COLOR_PALETTE.length],
    });
  };

  // ── Drag and Drop Move Handler ───────────────────────────────────────────────
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    // ── Handle Stage Column Reordering (type="STAGE") ──
    if (type === 'STAGE') {
      if (!activePipeline) return;
      const reorderedStages = Array.from(stages);
      const [movedStage] = reorderedStages.splice(source.index, 1);
      reorderedStages.splice(destination.index, 0, movedStage);

      const updatedStagesWithOrder = reorderedStages.map((s, idx) => ({ ...s, order: idx }));

      // Optimistic update in React Query cache for instant pickup and drop feel
      qc.setQueryData<Pipeline[]>(['opportunities-pipelines'], old => {
        if (!old) return old;
        return old.map(p => {
          if (p.id === activePipeline.id) {
            return { ...p, stages: updatedStagesWithOrder };
          }
          return p;
        });
      });

      try {
        await opportunitiesApi.reorderStages(
          activePipeline.id,
          updatedStagesWithOrder.map(s => s.id)
        );
      } catch (err: any) {
        qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
        toast('error', 'Failed to save stage order', err.message);
      }
      return;
    }

    // ── Handle Deal Movement Between / Within Stages ──
    if (destination.droppableId === source.droppableId) return;

    const targetStage = stages.find(s => s.id === destination.droppableId);
    const deal = opportunities.find(d => d.id === draggableId);
    if (!targetStage || !deal) return;

    // Check if moving to Won or Lost stage
    if (targetStage.isWon) {
      setWonLostPromptDeal({ deal, type: 'won', targetStage });
      return;
    }
    if (targetStage.isLost) {
      setWonLostPromptDeal({ deal, type: 'lost', targetStage });
      return;
    }

    // Check required fields for the destination stage
    const reqFields = parseJsonSafe<string[]>(targetStage.requiredFieldsJson, []);
    if (reqFields.length > 0) {
      const missing: string[] = [];
      const customObj = deal.customFields || {};
      for (const rf of reqFields) {
        if (rf === 'contactId' && !deal.contactId) missing.push('Contact');
        else if (rf === 'amount' && !deal.amount) missing.push('Value');
        else if (rf === 'closeDate' && !deal.closeDate) missing.push('Close Date');
        else if (rf === 'source' && !deal.source) missing.push('Source');
        else if (rf.startsWith('cf_')) {
          const k = rf.replace('cf_', '');
          if (!customObj[k]) missing.push(k);
        }
      }
      if (missing.length > 0) {
        setRequiredFieldsDeal(deal);
        setRequiredFieldsTargetStage(targetStage);
        return;
      }
    }

    // 1. Optimistically update React Query cache immediately for buttery smooth drop
    qc.setQueriesData({ queryKey: ['opportunities'] }, (oldData: any) => {
      if (!oldData) return oldData;
      if (Array.isArray(oldData)) {
        return oldData.map(d => d.id === deal.id ? { ...d, pipelineStageId: targetStage.id } : d);
      }
      if (oldData.opportunities && Array.isArray(oldData.opportunities)) {
        return {
          ...oldData,
          opportunities: oldData.opportunities.map((d: Opportunity) =>
            d.id === deal.id ? { ...d, pipelineStageId: targetStage.id } : d
          )
        };
      }
      return oldData;
    });

    // 2. Execute move in backend
    try {
      await opportunitiesApi.update(deal.id, { pipelineStageId: targetStage.id });
      qc.invalidateQueries({ queryKey: ['opportunities'] });
    } catch (e: any) {
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      toast('error', 'Failed to move deal', e.message);
    }
  };

  // ── Bulk Actions ─────────────────────────────────────────────────────────────
  const handleBulkAction = async (action: string, payload?: any) => {
    if (selectedIds.length === 0) return;
    try {
      const res = await opportunitiesApi.bulk(action, selectedIds, payload);
      if (action === 'export' && typeof res.csv === 'string') {
        const blob = new Blob([res.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `opportunities-selected.csv`;
        a.click();
      }
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      toast('success', 'Bulk action completed');
    } catch (e: any) {
      toast('error', 'Bulk action failed', e.message);
    }
  };

  const handleExportAll = async () => {
    try {
      const csv = await opportunitiesApi.export({ pipelineId: activePipeline?.id });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activePipeline?.name || 'opportunities'}.csv`;
      a.click();
      toast('success', 'Export completed');
    } catch (e: any) {
      toast('error', 'Export failed', e.message);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const toggleSelectStageGroup = (stageDeals: Opportunity[]) => {
    const stageDealIds = stageDeals.map(d => d.id);
    const allSelected = stageDealIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !stageDealIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...stageDealIds])));
    }
  };

  const toggleCollapseStage = (stageId: string) => {
    setCollapsedStageIds(prev =>
      prev.includes(stageId) ? prev.filter(id => id !== stageId) : [...prev, stageId]
    );
  };

  // Group deals by stage for Kanban and Grouped List
  const dealsByStage = useMemo(() => {
    const map: Record<string, Opportunity[]> = {};
    for (const s of stages) map[s.id] = [];
    for (const opp of opportunities) {
      const sId = opp.pipelineStageId || (stages[0]?.id);
      if (!map[sId]) map[sId] = [];
      map[sId].push(opp);
    }
    return map;
  }, [stages, opportunities]);

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden relative">
      {/* ── Header Bar ───────────────────────────────────────────────────────── */}
      <header className="px-6 py-3.5 border-b border-border bg-surface shrink-0 flex items-center justify-between gap-4 z-20">
        {/* Left: Title + Pipeline Switcher */}
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[18px] font-bold text-text-main shrink-0">Opportunities</h1>

          {/* Pipeline Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPipelineSwitcher(o => !o)}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface-hover/60 hover:bg-surface-hover border border-border rounded-xl text-[13px] font-semibold text-text-main transition-colors"
            >
              <span>{activePipeline?.name || 'Sales Pipeline'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            </button>

            <AnimatePresence>
              {showPipelineSwitcher && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute top-full left-0 mt-1 z-40 bg-surface border border-border rounded-2xl shadow-2xl p-1.5 min-w-[220px] max-h-72 overflow-y-auto"
                >
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-3 py-1.5">
                    Select Pipeline
                  </div>
                  {pipelines.map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setActivePipelineId(p.id);
                        setShowPipelineSwitcher(false);
                      }}
                      className={`px-3 py-2 rounded-xl text-[13px] flex items-center justify-between cursor-pointer transition-colors ${
                        activePipeline?.id === p.id ? 'bg-primary text-white font-semibold' : 'text-text-main hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        {p.isDefault && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/20 text-text-muted font-bold">
                            Default
                          </span>
                        )}
                      </div>
                      {activePipeline?.id === p.id && <Check className="w-4 h-4" />}
                    </div>
                  ))}

                  <div className="pt-1 mt-1 border-t border-border flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPipelineSwitcher(false);
                        setShowNewPipelineModal(true);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-xl text-[12px] font-bold text-white bg-primary hover:bg-primary-hover flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-white" />
                      <span>+ New Pipeline</span>
                    </button>
                    <Link
                      to="/opportunities/settings/pipelines"
                      onClick={() => setShowPipelineSwitcher(false)}
                      className="p-1.5 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                      title="Pipeline Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center/Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Live Search */}
          <div className="relative w-56 md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search opportunity or contact..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-surface-hover/50 border border-border rounded-xl text-[12px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-text-muted hover:text-text-main"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Toggle Segmented Control: Board / List */}
          <div className="flex items-center p-1 bg-surface-hover/60 border border-border rounded-xl">
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'board' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
              title="Board View (Kanban)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main'
              }`}
              title="Grouped List View"
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilterDrawer(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-all ${
              activeFiltersCount > 0
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-surface-hover/60 border-border text-text-muted hover:text-text-main'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Filter</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-hover/60 hover:bg-surface-hover border border-border rounded-xl text-[12px] font-semibold text-text-muted hover:text-text-main transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Sort</span>
            </button>

            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute right-0 top-full mt-1 z-40 bg-surface border border-border rounded-2xl shadow-2xl p-1.5 min-w-[190px]"
                >
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-3 py-1">
                    Sort Opportunities
                  </div>
                  {[
                    { id: 'value_desc', label: 'Value (High to Low)', field: 'amount', order: 'desc' },
                    { id: 'value_asc', label: 'Value (Low to High)', field: 'amount', order: 'asc' },
                    { id: 'created_desc', label: 'Created Date (Newest)', field: 'createdAt', order: 'desc' },
                    { id: 'created_asc', label: 'Created Date (Oldest)', field: 'createdAt', order: 'asc' },
                    { id: 'close_asc', label: 'Close Date (Earliest)', field: 'closeDate', order: 'asc' },
                    { id: 'updated_desc', label: 'Last Updated', field: 'updatedAt', order: 'desc' },
                    { id: 'name_asc', label: 'Alphabetical (A–Z)', field: 'title', order: 'asc' },
                  ].map(opt => {
                    const isSelected = sortBy === opt.field && sortOrder === opt.order;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSortBy(opt.field);
                          setSortOrder(opt.order as any);
                          setShowSortMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-[12px] flex items-center justify-between transition-colors ${
                          isSelected ? 'bg-primary text-white font-semibold' : 'text-text-main hover:bg-surface-hover'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Import / Export Buttons */}
          <button
            onClick={() => setShowImportModal(true)}
            className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl border border-border transition-colors hidden sm:flex items-center"
            title="Import Opportunities"
          >
            <Upload className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportAll}
            className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl border border-border transition-colors hidden sm:flex items-center"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* + New Opportunity Primary Button */}
          <button
            onClick={() => {
              setCreateStageTargetId(undefined);
              setShowCreateModal(true);
            }}
            className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Opportunity</span>
          </button>

          {/* Overflow Menu ("...") */}
          <div className="relative">
            <button
              onClick={() => setShowOverflowMenu(o => !o)}
              className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl border border-border transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {showOverflowMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute right-0 top-full mt-1 z-40 bg-surface border border-border rounded-2xl shadow-2xl p-1.5 min-w-[200px]"
                >
                  <Link
                    to="/opportunities/settings/pipelines"
                    onClick={() => setShowOverflowMenu(false)}
                    className="px-3 py-2 rounded-xl text-[12px] font-medium text-text-main hover:bg-surface-hover flex items-center gap-2 transition-colors"
                  >
                    <Sliders className="w-4 h-4 text-text-muted" /> Manage Pipelines
                  </Link>
                  <Link
                    to="/opportunities/settings/fields"
                    onClick={() => setShowOverflowMenu(false)}
                    className="px-3 py-2 rounded-xl text-[12px] font-medium text-text-main hover:bg-surface-hover flex items-center gap-2 transition-colors"
                  >
                    <Layers className="w-4 h-4 text-text-muted" /> Manage Custom Fields
                  </Link>
                  <Link
                    to="/opportunities/settings/tags"
                    onClick={() => setShowOverflowMenu(false)}
                    className="px-3 py-2 rounded-xl text-[12px] font-medium text-text-main hover:bg-surface-hover flex items-center gap-2 transition-colors"
                  >
                    <TagIcon className="w-4 h-4 text-text-muted" /> Manage Tags
                  </Link>
                  <div className="h-[1px] bg-border my-1" />
                  <button
                    onClick={() => {
                      setShowSavedViewsModal(true);
                      setShowOverflowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-[12px] font-medium text-text-main hover:bg-surface-hover flex items-center gap-2 transition-colors"
                  >
                    <Bookmark className="w-4 h-4 text-text-muted" /> Saved Views
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomizeCardModal(true);
                      setShowOverflowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-[12px] font-medium text-text-main hover:bg-surface-hover flex items-center gap-2 transition-colors"
                  >
                    <LayoutGrid className="w-4 h-4 text-text-muted" /> Customize Cards
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ── Main View Container ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {loadingOpps || loadingPipelines ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-xs text-text-muted">Loading opportunities...</span>
            </div>
          </div>
        ) : opportunities.length === 0 && !searchQuery && activeFiltersCount === 0 && stages.length === 0 ? (
          /* Empty Pipeline State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-[20px] font-bold text-text-main">No stages yet in {activePipeline?.name}</h2>
              <p className="text-[13px] text-text-muted max-w-sm mt-1">
                Add your first sales stage to start tracking opportunities.
              </p>
            </div>
            <button
              onClick={() => setIsAddingNewStage(true)}
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold rounded-xl inline-flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" /> Add First Stage
            </button>
          </div>
        ) : viewMode === 'board' ? (
          /* ── Board (Kanban) View with Add Stage on Right ─────────────────────── */
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="board-all-stages" direction="horizontal" type="STAGE">
                {(stageDroppableProvided) => (
                  <div
                    ref={stageDroppableProvided.innerRef}
                    {...stageDroppableProvided.droppableProps}
                    className="flex gap-4 h-full items-start min-w-max pb-2"
                  >
                    {stages.map((stage, stageIndex) => {
                      const stageDeals = dealsByStage[stage.id] || [];
                      const stageTotalVal = stageDeals.reduce((s, d) => s + (d.amount || 0), 0);

                      return (
                        <Draggable key={stage.id} draggableId={stage.id} index={stageIndex}>
                          {(stageDraggableProvided, stageSnapshot) => {
                            const { style: stageStyle, ...stageDraggablePropsWithoutStyle } = stageDraggableProvided.draggableProps;
                            return (
                              <div
                                ref={stageDraggableProvided.innerRef}
                                {...stageDraggablePropsWithoutStyle}
                                style={stageStyle as React.CSSProperties}
                                className={`w-80 h-full flex flex-col bg-surface/60 border rounded-2xl overflow-hidden shadow-xs shrink-0 select-none transition-all ${
                                  stageSnapshot.isDragging
                                    ? 'ring-2 ring-primary shadow-2xl scale-[1.02] bg-surface z-50 opacity-95 rotate-[0.5deg]'
                                    : 'border-border'
                                }`}
                              >
                                {/* Column Header (Stage Drag Handle) */}
                                <div
                                  {...stageDraggableProvided.dragHandleProps}
                                  className="p-3.5 border-b border-border bg-surface/80 flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing hover:bg-surface-hover/50 transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <GripVertical className="w-3.5 h-3.5 text-text-muted hover:text-text-main shrink-0 opacity-60" />
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                                    {editingStageId === stage.id ? (
                                      <input
                                        autoFocus
                                        defaultValue={stage.name}
                                        onClick={e => e.stopPropagation()}
                                        onBlur={e => {
                                          if (e.target.value.trim() && e.target.value !== stage.name) {
                                            updateStageMut.mutate({ id: stage.id, data: { name: e.target.value.trim() } });
                                          }
                                          setEditingStageId(null);
                                        }}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            if (e.currentTarget.value.trim() && e.currentTarget.value !== stage.name) {
                                              updateStageMut.mutate({ id: stage.id, data: { name: e.currentTarget.value.trim() } });
                                            }
                                            setEditingStageId(null);
                                          } else if (e.key === 'Escape') {
                                            setEditingStageId(null);
                                          }
                                        }}
                                        className="text-[13px] font-bold bg-surface border border-primary rounded px-1 py-0.5 focus:outline-none w-28 text-text-main"
                                      />
                                    ) : (
                                      <h3
                                        onClick={e => {
                                          e.stopPropagation();
                                          setEditingStageId(stage.id);
                                        }}
                                        className="text-[13px] font-bold text-text-main truncate hover:text-primary cursor-pointer"
                                        title="Click to rename stage"
                                      >
                                        {stage.name}
                                      </h3>
                                    )}
                                    <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-surface-hover border border-border text-text-muted font-mono font-semibold">
                                      {stageDeals.length}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                    <span className="text-[12px] font-bold text-text-main font-mono mr-0.5">
                                      ${stageTotalVal.toLocaleString()}
                                    </span>
                                    <button
                                      onClick={() => {
                                        setCreateStageTargetId(stage.id);
                                        setShowCreateModal(true);
                                      }}
                                      className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                                      title={`Add opportunity to ${stage.name}`}
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                    {stages.length > 1 && (
                                      <button
                                        type="button"
                                        onMouseDown={e => e.stopPropagation()}
                                        onClick={e => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          setStageToDelete(stage);
                                        }}
                                        className="p-1 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                        title={`Remove stage "${stage.name}"`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Column Droppable Body for Deals */}
                                <Droppable droppableId={stage.id} type="DEAL">
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.droppableProps}
                                      className={`flex-1 overflow-y-auto p-3 space-y-2.5 transition-colors ${
                                        snapshot.isDraggingOver ? 'bg-primary/5' : ''
                                      }`}
                                    >
                                      {stageDeals.length === 0 ? (
                                        <div className="h-32 border-2 border-dashed border-border/50 rounded-xl flex flex-col items-center justify-center text-center p-4">
                                          <span className="text-[11px] text-slate-300">No opportunities in this stage</span>
                                          <button
                                            onClick={() => {
                                              setCreateStageTargetId(stage.id);
                                              setShowCreateModal(true);
                                            }}
                                            className="mt-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                                          >
                                            <Plus className="w-3.5 h-3.5 text-white" />
                                            <span className="text-white">Quick Add</span>
                                          </button>
                                        </div>
                                      ) : (
                                        stageDeals.map((deal, index) => (
                                          <KanbanCard
                                            key={deal.id}
                                            deal={deal}
                                            index={index}
                                            stage={stage}
                                            staleThresholdDays={activePipeline?.staleThresholdDays || 14}
                                            cardConfig={cardConfig}
                                            customFields={customFields}
                                            onNavigate={() => navigate(`/opportunities/${deal.id}`)}
                                            onDelete={() => setDealToDelete(deal)}
                                            onMarkWon={() => setWonLostPromptDeal({ deal, type: 'won' })}
                                            onMarkLost={() => setWonLostPromptDeal({ deal, type: 'lost' })}
                                          />
                                        ))
                                      )}
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              </div>
                            );
                          }}
                        </Draggable>
                      );
                    })}
                    {stageDroppableProvided.placeholder}

                {/* ── Add Stage Column (Same size as other columns) ─────────────── */}
                <div className="w-80 h-full shrink-0 flex flex-col bg-surface/40 hover:bg-surface/60 border-2 border-dashed border-border/80 hover:border-primary/50 rounded-2xl overflow-hidden shadow-xs transition-all">
                  {isAddingNewStage ? (
                    <div className="flex flex-col h-full bg-surface">
                      {/* Column Header */}
                      <div className="p-3.5 border-b border-border bg-surface/90 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: newStageColor }} />
                          <h3 className="text-[13px] font-bold text-text-main">New Stage</h3>
                        </div>
                        <button
                          onClick={() => {
                            setIsAddingNewStage(false);
                            setNewStageName('');
                          }}
                          className="text-text-muted hover:text-text-main p-1 rounded-lg hover:bg-surface-hover"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Column Body */}
                      <div className="p-4 flex-1 flex flex-col justify-between overflow-y-auto">
                        <div className="space-y-4">
                          <div>
                            <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                              Stage Name
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Under Review, Qualified..."
                              value={newStageName}
                              onChange={e => setNewStageName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && newStageName.trim()) handleCreateNewStage();
                                if (e.key === 'Escape') setIsAddingNewStage(false);
                              }}
                              autoFocus
                              className="w-full px-3.5 py-2.5 bg-surface-hover/70 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary shadow-inner"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                              Stage Color
                            </label>
                            <div className="grid grid-cols-7 gap-2 p-2.5 bg-surface-hover/40 rounded-xl border border-border/50">
                              {STAGE_COLOR_PALETTE.map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setNewStageColor(c)}
                                  className={`w-6 h-6 rounded-full transition-transform mx-auto ${
                                    newStageColor === c ? 'scale-125 ring-2 ring-white shadow-xs' : 'hover:scale-110'
                                  }`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/50">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingNewStage(false);
                              setNewStageName('');
                            }}
                            className="px-3.5 py-2 text-xs text-text-muted hover:text-text-main font-semibold rounded-xl"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateNewStage}
                            disabled={!newStageName.trim() || createStageMut.isPending}
                            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5 text-white" />
                            <span>{createStageMut.isPending ? 'Creating...' : 'Create Stage'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                      <button
                        onClick={() => setIsAddingNewStage(true)}
                        className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-white transition-all group cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-surface-hover group-hover:bg-primary text-white flex items-center justify-center transition-all shadow-xs group-hover:scale-110">
                          <Plus className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-center">
                          <span className="text-[14px] font-bold block text-white">Add Stage</span>
                          <span className="text-[11px] text-slate-300 mt-0.5 block">Create a new pipeline column</span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      ) : (
          /* ── Monday.com-styled Grouped Stages List View ────────── */
          <div className="flex-1 overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="space-y-8 max-w-7xl mx-auto pb-16">
                {stages.map(stage => {
                  const stageDeals = dealsByStage[stage.id] || [];
                  const stageTotal = stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
                  const isCollapsed = collapsedStageIds.includes(stage.id);

                  return (
                    <div key={stage.id} className="flex flex-col space-y-2.5">
                      {/* Stage Group Header (Monday.com style) */}
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedStageIds(prev =>
                                prev.includes(stage.id)
                                  ? prev.filter(id => id !== stage.id)
                                  : [...prev, stage.id]
                              )
                            }
                            className="p-1 rounded-lg hover:bg-surface-hover transition-colors"
                            style={{ color: stage.color }}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>

                          {/* Stage Title in Stage Color with Inline Rename */}
                          {editingStageId === stage.id ? (
                            <input
                              autoFocus
                              defaultValue={stage.name}
                              onBlur={e => {
                                if (e.target.value.trim() && e.target.value !== stage.name) {
                                  updateStageMut.mutate({
                                    id: stage.id,
                                    data: { name: e.target.value.trim() },
                                  });
                                }
                                setEditingStageId(null);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  if (e.currentTarget.value.trim() && e.currentTarget.value !== stage.name) {
                                    updateStageMut.mutate({
                                      id: stage.id,
                                      data: { name: e.currentTarget.value.trim() },
                                    });
                                  }
                                  setEditingStageId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingStageId(null);
                                }
                              }}
                              className="text-[16px] font-bold bg-surface border border-primary rounded-lg px-2 py-0.5 focus:outline-none"
                              style={{ color: stage.color }}
                            />
                          ) : (
                            <h3
                              onClick={() => setEditingStageId(stage.id)}
                              className="text-[16px] font-bold cursor-pointer hover:opacity-80 flex items-center gap-2 transition-opacity"
                              style={{ color: stage.color }}
                              title="Click to rename stage"
                            >
                              <span>{stage.name}</span>
                              <Edit2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-text-muted" />
                            </h3>
                          )}

                          {/* Deals Count Badge */}
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-surface border border-border text-slate-200 font-bold font-mono">
                            {stageDeals.length} Deals
                          </span>

                          {/* Stage Color Swatch Button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveColorPickerStageId(
                                  activeColorPickerStageId === stage.id ? null : stage.id
                                )
                              }
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs cursor-pointer hover:scale-125 transition-transform"
                              style={{ backgroundColor: stage.color }}
                              title="Change stage color"
                            />

                            {/* Color Popover */}
                            <AnimatePresence>
                              {activeColorPickerStageId === stage.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setActiveColorPickerStageId(null)}
                                  />
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="absolute left-0 top-full mt-2 bg-surface border border-border shadow-2xl rounded-2xl p-3 z-50 w-[210px]"
                                  >
                                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                                      Stage Color
                                    </div>
                                    <div className="grid grid-cols-5 gap-2">
                                      {STAGE_COLOR_PALETTE.map(color => (
                                        <button
                                          key={color}
                                          type="button"
                                          onClick={() => {
                                            updateStageMut.mutate({ id: stage.id, data: { color } });
                                          }}
                                          className="w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform border border-black/20"
                                          style={{ backgroundColor: color }}
                                        />
                                      ))}
                                    </div>
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Stage Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setCreateStageTargetId(stage.id);
                              setShowCreateModal(true);
                            }}
                            className="px-3 py-1 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5 text-white" />
                            <span className="text-white">Add Deal</span>
                          </button>

                          {stages.length > 1 && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setStageToDelete(stage);
                              }}
                              className="p-1 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title={`Delete stage "${stage.name}"`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Monday.com Styled Table Container */}
                      {!isCollapsed && (
                        <div className="bg-surface/70 border border-border rounded-2xl overflow-hidden shadow-xs">
                          <table className="w-full text-left border-collapse text-[13px]">
                            <thead className="border-b border-border bg-surface-hover/30 text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                              <tr>
                                <th className="py-3 px-3 w-8 text-center relative">
                                  <div
                                    className="w-[4px] absolute left-0 top-0 bottom-0"
                                    style={{ backgroundColor: stage.color }}
                                  />
                                </th>
                                <th className="py-3 px-3 w-10 text-center">
                                  <input
                                    type="checkbox"
                                    checked={
                                      stageDeals.length > 0 &&
                                      stageDeals.every(d => selectedIds.includes(d.id))
                                    }
                                    onChange={() => toggleSelectStageGroup(stageDeals)}
                                    className="w-3.5 h-3.5 rounded text-primary"
                                  />
                                </th>
                                <th className="py-3 px-4 font-semibold text-white min-w-[200px]">Deal</th>
                                <th className="py-3 px-4 font-semibold text-slate-300 text-center min-w-[130px]">Activities</th>
                                <th className="py-3 px-4 font-semibold text-slate-300 text-center min-w-[130px]">Stage</th>
                                <th className="py-3 px-4 font-semibold text-slate-300 text-center min-w-[100px]">Owner</th>
                                <th className="py-3 px-4 font-semibold text-slate-300 text-center min-w-[110px]">Deal Value</th>
                                <th className="py-3 px-4 font-semibold text-slate-300 min-w-[140px]">Contacts</th>
                                <th className="py-3 px-4 font-semibold text-slate-300 min-w-[140px]">Accounts</th>
                                <th className="py-3 px-3 text-right w-12 text-slate-300"></th>
                              </tr>
                            </thead>

                            <Droppable droppableId={stage.id} type="DEAL">
                              {(provided, snapshot) => (
                                <tbody
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`divide-y divide-border/50 transition-colors ${
                                    snapshot.isDraggingOver ? 'bg-primary/5' : ''
                                  }`}
                                >
                                  {stageDeals.map((deal, index) => {
                                    const isSelected = selectedIds.includes(deal.id);
                                    return (
                                      <Draggable key={deal.id} draggableId={deal.id} index={index}>
                                        {(drag, dragSnapshot) => {
                                          const { style, ...draggablePropsWithoutStyle } = drag.draggableProps;
                                          return (
                                            <tr
                                              ref={drag.innerRef}
                                              {...draggablePropsWithoutStyle}
                                              style={style as React.CSSProperties}
                                              onClick={() => navigate(`/opportunities/${deal.id}`)}
                                              className={`group/row cursor-pointer select-none transition-colors ${
                                                dragSnapshot.isDragging
                                                  ? 'bg-surface shadow-2xl ring-2 ring-primary z-50'
                                                  : isSelected
                                                  ? 'bg-primary/10'
                                                  : 'hover:bg-surface-hover/60'
                                              }`}
                                            >
                                              {/* Left Stage Color Strip + Drag Handle */}
                                              <td
                                                className="py-3 px-3 text-center relative"
                                                onClick={e => e.stopPropagation()}
                                              >
                                                <div
                                                  className="w-[px] absolute left-0 top-0 bottom-0"
                                                  style={{ backgroundColor: stage.color }}
                                                />
                                                <div
                                                  {...drag.dragHandleProps}
                                                  className="flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover/row:opacity-70 hover:opacity-100 p-0.5"
                                                >
                                                  <GripVertical className="w-3.5 h-3.5 text-text-muted" />
                                                </div>
                                              </td>

                                              {/* Checkbox */}
                                              <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={() => toggleSelectRow(deal.id)}
                                                  className="w-3.5 h-3.5 rounded text-primary"
                                                />
                                              </td>

                                              {/* Deal Title + Sparkle */}
                                              <td className="py-3 px-4 font-bold text-white">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-white hover:text-primary transition-colors text-[13.5px]">
                                                    {deal.title}
                                                  </span>
                                                  <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                    <span className="p-1 rounded-md text-text-muted hover:text-primary hover:bg-surface-hover" title="AI Summary">
                                                      <Sparkles className="w-3.5 h-3.5" />
                                                    </span>
                                                  </div>
                                                </div>
                                              </td>

                                              {/* Activities Timeline Mini-Bar */}
                                              <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-hover/40 border border-border/50">
                                                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400" title="Completed activities" />
                                                  <span className="w-2.5 h-2.5 rounded-xs bg-primary" title="Upcoming activities" />
                                                  <span className="w-2.5 h-2.5 rounded-xs bg-surface-hover" />
                                                  <span className="w-2.5 h-2.5 rounded-xs bg-surface-hover" />
                                                </div>
                                              </td>

                                              {/* Stage Pill (Monday.com Full-Color Block) */}
                                              <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                                                <div
                                                  style={{ backgroundColor: stage.color }}
                                                  className="text-white text-xs font-bold py-1.5 px-3 rounded-lg text-center shadow-xs inline-block min-w-[100px] cursor-default"
                                                >
                                                  {stage.name}
                                                </div>
                                              </td>

                                              {/* Owner Avatar */}
                                              <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                                                <div className="inline-flex items-center justify-center">
                                                  <div className="w-7 h-7 rounded-full bg-surface-hover border border-border text-slate-200 text-xs font-bold flex items-center justify-center shadow-xs" title={deal.ownerId || 'Unassigned'}>
                                                    {deal.ownerId ? deal.ownerId[0].toUpperCase() : <User className="w-3.5 h-3.5 text-text-muted" />}
                                                  </div>
                                                </div>
                                              </td>

                                              {/* Deal Value */}
                                              <td className="py-3 px-4 text-center font-bold font-mono text-white text-[13.5px]">
                                                ${deal.amount.toLocaleString()}
                                              </td>

                                              {/* Contacts Pill */}
                                              <td className="py-3 px-4 text-xs" onClick={e => e.stopPropagation()}>
                                                {deal.contact ? (
                                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-hover/60 border border-border text-white font-medium">
                                                    <User className="w-3.5 h-3.5 text-primary" />
                                                    <span>{deal.contact.firstName} {deal.contact.lastName || ''}</span>
                                                  </div>
                                                ) : (
                                                  <span className="text-slate-500">—</span>
                                                )}
                                              </td>

                                              {/* Accounts / Company Pill */}
                                              <td className="py-3 px-4 text-xs" onClick={e => e.stopPropagation()}>
                                                {deal.company ? (
                                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-hover/60 border border-border text-slate-200 font-medium">
                                                    <Building2 className="w-3.5 h-3.5 text-text-muted" />
                                                    <span>{deal.company.name}</span>
                                                  </div>
                                                ) : deal.source ? (
                                                  <span className="text-slate-400">{deal.source}</span>
                                                ) : (
                                                  <span className="text-slate-500">—</span>
                                                )}
                                              </td>

                                              {/* Row Action Arrow */}
                                              <td className="py-3 px-3 text-right" onClick={e => e.stopPropagation()}>
                                                <button
                                                  onClick={() => navigate(`/opportunities/${deal.id}`)}
                                                  className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover opacity-0 group-hover/row:opacity-100 transition-opacity"
                                                >
                                                  <ArrowRight className="w-4 h-4" />
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        }}
                                      </Draggable>
                                    );
                                  })}
                                  {provided.placeholder}

                                  {/* Inline + Add Deal Row (Monday.com style) */}
                                  <tr
                                    onClick={() => {
                                      setCreateStageTargetId(stage.id);
                                      setShowCreateModal(true);
                                    }}
                                    className="hover:bg-surface-hover/40 cursor-pointer border-t border-border/50 text-xs font-semibold text-text-muted hover:text-white transition-colors"
                                  >
                                    <td className="py-2.5 px-3 text-center relative">
                                      <div
                                        className="w-[4px] absolute left-0 top-0 bottom-0 opacity-40"
                                        style={{ backgroundColor: stage.color }}
                                      />
                                    </td>
                                    <td className="py-2.5 px-3"></td>
                                    <td colSpan={8} className="py-2.5 px-4">
                                      <div className="flex items-center gap-2">
                                        <Plus className="w-3.5 h-3.5 text-white" />
                                        <span className="text-slate-300 hover:text-white font-medium">+ Add deal</span>
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              )}
                            </Droppable>
                          </table>

                          {/* Group Summary Footer Row (Monday.com style) */}
                          <div className="bg-surface/90 border-t border-border px-4 py-2.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-2 w-28 rounded-full shadow-xs"
                                style={{ backgroundColor: stage.color }}
                              />
                              <span className="text-slate-400 font-medium">
                                {stageDeals.length} opportunity{stageDeals.length === 1 ? '' : 'ies'}
                              </span>
                            </div>

                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <div className="text-[13px] font-bold font-mono text-white">
                                  ${stageTotal.toLocaleString()}
                                </div>
                                <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                                  sum
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Bottom Add Stage Button in List View */}
                <div className="pt-4 border-t border-border flex items-center justify-center">
                  <button
                    onClick={() => {
                      setViewMode('board');
                      setIsAddingNewStage(true);
                    }}
                    className="px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all"
                  >
                    <Plus className="w-4 h-4 text-white" />
                    <span className="text-white">+ Add New Stage</span>
                  </button>
                </div>
              </div>
            </DragDropContext>
          </div>
        )}

        {/* ── Bulk Action Bar ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface border border-primary/40 rounded-2xl shadow-2xl px-6 py-3 flex items-center gap-4 text-xs font-semibold text-text-main backdrop-blur-md"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                  {selectedIds.length}
                </span>
                <span>Selected</span>
              </div>

              <div className="h-4 w-[1px] bg-border" />

              {/* Move Stage in Bulk */}
              <select
                onChange={e => {
                  if (e.target.value) handleBulkAction('change_stage', { stageId: e.target.value });
                }}
                defaultValue=""
                className="px-3 py-1.5 bg-surface-hover border border-border rounded-xl text-xs text-text-main"
              >
                <option value="" disabled>Change Stage...</option>
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <button
                onClick={() => handleBulkAction('export')}
                className="px-3 py-1.5 bg-surface-hover hover:bg-surface-hover/80 border border-border rounded-xl flex items-center gap-1.5 text-text-main"
              >
                <Download className="w-3.5 h-3.5" /> Export Selected
              </button>

              <button
                onClick={() => handleBulkAction('delete')}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Selected
              </button>

              <button
                onClick={() => setSelectedIds([])}
                className="text-text-muted hover:text-text-main p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modals & Drawers ─────────────────────────────────────────────────── */}
      <CreateOpportunityModal
        isOpen={showCreateModal}
        initialPipelineId={activePipeline?.id}
        initialStageId={createStageTargetId}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['opportunities'] })}
      />

      <FilterSlideOver
        isOpen={showFilterDrawer}
        onClose={() => setShowFilterDrawer(false)}
        stages={stages}
        tags={tags}
        customFields={customFields}
        teamMembers={[]}
        filters={filters}
        onFilterChange={setFilters}
        onClearAll={() => setFilters({ stages: [], owners: [], tags: [], sources: [], customFields: {} })}
      />

      <CustomizeCardModal
        isOpen={showCustomizeCardModal}
        config={cardConfig}
        customFields={customFields}
        onClose={() => setShowCustomizeCardModal(false)}
        onSave={setCardConfig}
      />

      <ImportOpportunitiesModal
        isOpen={showImportModal}
        pipelines={pipelines}
        activePipelineId={activePipeline?.id}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['opportunities'] })}
      />

      <SavedViewsModal
        isOpen={showSavedViewsModal}
        pipelineId={activePipeline?.id}
        currentFilters={filters}
        currentSort={{ field: sortBy, order: sortOrder }}
        currentCardConfig={cardConfig}
        currentViewType={viewMode}
        existingViews={savedViews}
        onClose={() => setShowSavedViewsModal(false)}
        onSelectView={(view) => {
          try {
            const parsedFilters = JSON.parse(view.filtersJson);
            setFilters(parsedFilters);
          } catch {}
          setViewMode(view.viewType === 'list' ? 'list' : 'board');
          toast('success', `Applied view: ${view.name}`);
        }}
        onSavedViewCreated={() => qc.invalidateQueries({ queryKey: ['opportunities-saved-views'] })}
      />

      {/* Required Fields Inline Transition Modal */}
      <RequiredFieldsModal
        isOpen={Boolean(requiredFieldsDeal && requiredFieldsTargetStage)}
        opportunity={requiredFieldsDeal}
        targetStage={requiredFieldsTargetStage}
        customFields={customFields}
        onClose={() => {
          setRequiredFieldsDeal(null);
          setRequiredFieldsTargetStage(null);
        }}
        onConfirm={async (collectedValues) => {
          if (!requiredFieldsDeal || !requiredFieldsTargetStage) return;
          try {
            await opportunitiesApi.update(requiredFieldsDeal.id, {
              pipelineStageId: requiredFieldsTargetStage.id,
              ...collectedValues,
            });
            qc.invalidateQueries({ queryKey: ['opportunities'] });
            setRequiredFieldsDeal(null);
            setRequiredFieldsTargetStage(null);
            toast('success', `Moved to ${requiredFieldsTargetStage.name}`);
          } catch (e: any) {
            toast('error', 'Failed to move deal', e.message);
          }
        }}
      />

      {/* Won / Lost Reason Prompt Modal */}
      <WonLostReasonModal
        isOpen={Boolean(wonLostPromptDeal)}
        type={wonLostPromptDeal?.type || 'won'}
        reasons={activePipeline?.wonLostReasons || []}
        opportunityTitle={wonLostPromptDeal?.deal.title}
        onClose={() => setWonLostPromptDeal(null)}
        onConfirm={async ({ reason, notes }) => {
          if (!wonLostPromptDeal) return;
          try {
            const updatePayload: any = {
              status: wonLostPromptDeal.type,
              wonLostReason: reason,
              wonLostNotes: notes,
            };
            if (wonLostPromptDeal.targetStage) {
              updatePayload.pipelineStageId = wonLostPromptDeal.targetStage.id;
            }
            await opportunitiesApi.update(wonLostPromptDeal.deal.id, updatePayload);
            qc.invalidateQueries({ queryKey: ['opportunities'] });
            toast('success', `Deal marked as ${wonLostPromptDeal.type}`);
          } catch (e: any) {
            toast('error', 'Failed to update deal', e.message);
          }
        }}
      />
      <AnimatePresence>
        {stageToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-400">
                  <Trash2 className="w-5 h-5" />
                  <h3 className="text-base font-bold text-text-main">Delete Stage</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setStageToDelete(null)}
                  className="text-text-muted hover:text-text-main p-1 rounded-lg hover:bg-surface-hover"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[13px] text-text-muted">
                Are you sure you want to delete stage <strong className="text-text-main">"{stageToDelete.name}"</strong>?
              </p>

              {(dealsByStage[stageToDelete.id] || []).length > 0 && (
                <div className="space-y-2 p-3 rounded-xl bg-surface-hover/60 border border-border">
                  <span className="text-xs font-semibold text-text-main block">
                    Move {dealsByStage[stageToDelete.id].length} opportunity(ies) in this stage to:
                  </span>
                  <select
                    value={reassignmentStageId}
                    onChange={e => setReassignmentStageId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-xs text-text-main focus:outline-none focus:border-primary"
                  >
                    {stages.filter(s => s.id !== stageToDelete.id).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStageToDelete(null)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sId = stageToDelete.id;
                    const reassignId = reassignmentStageId || stages.find(s => s.id !== sId)?.id;
                    deleteStageMut.mutate({ id: sId, reassignmentStageId: reassignId });
                  }}
                  disabled={deleteStageMut.isPending}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleteStageMut.isPending ? 'Deleting...' : 'Delete Stage'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Opportunity Confirmation Modal */}
      <AnimatePresence>
        {dealToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-400">
                  <Trash2 className="w-5 h-5" />
                  <h3 className="text-base font-bold text-text-main">Delete Opportunity</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDealToDelete(null)}
                  className="text-text-muted hover:text-text-main p-1 rounded-lg hover:bg-surface-hover"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[13px] text-text-muted">
                Are you sure you want to permanently delete opportunity <strong className="text-text-main">"{dealToDelete.title}"</strong>?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDealToDelete(null)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteDealMut.mutate(dealToDelete.id)}
                  disabled={deleteDealMut.isPending}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleteDealMut.isPending ? 'Deleting...' : 'Delete Opportunity'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create New Pipeline Modal */}
      <AnimatePresence>
        {showNewPipelineModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <Sliders className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-text-main">Create New Pipeline</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewPipelineModal(false)}
                  className="text-text-muted hover:text-text-main p-1 rounded-lg hover:bg-surface-hover"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-text-muted block mb-1">Pipeline Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Strategic Deals, Partnerships, Expansion..."
                    value={newPipelineName}
                    onChange={e => setNewPipelineName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-xs text-text-main focus:outline-none focus:border-primary"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-text-muted block mb-1">Pipeline Template</label>
                  <select
                    value={newPipelinePreset}
                    onChange={e => setNewPipelinePreset(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-xs text-text-main focus:outline-none focus:border-primary"
                  >
                    <option value="sales">Standard B2B Sales (New Lead, Proposal Sent, Closed)</option>
                    <option value="saas">SaaS Inbound & Expansion (Discovery, Demo, Contract, Won)</option>
                    <option value="consulting">Consulting & Agency (Inquiry, Scoping, Proposal, Signed)</option>
                    <option value="realestate">Real Estate Deals (Lead, Tour, Offer, Closing)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowNewPipelineModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => createPipelineMut.mutate()}
                  disabled={!newPipelineName.trim() || createPipelineMut.isPending}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                  <span>{createPipelineMut.isPending ? 'Creating...' : 'Create Pipeline'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Kanban Card Subcomponent ───────────────────────────────────────────────────
function KanbanCard({
  deal,
  index,
  stage,
  staleThresholdDays,
  cardConfig,
  customFields,
  onNavigate,
  onDelete,
  onMarkWon,
  onMarkLost,
}: {
  deal: Opportunity;
  index: number;
  stage: Stage;
  staleThresholdDays: number;
  cardConfig: CardConfig;
  customFields: CustomField[];
  onNavigate: () => void;
  onDelete: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isStale = deal.daysInStage >= staleThresholdDays;

  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => {
        const { style, ...draggablePropsWithoutStyle } = provided.draggableProps;
        return (
          <div
            ref={provided.innerRef}
            {...draggablePropsWithoutStyle}
            {...provided.dragHandleProps}
            style={style as React.CSSProperties}
            onClick={onNavigate}
            className={`group rounded-2xl p-4 border select-none cursor-pointer relative ${
              snapshot.isDragging
                ? 'bg-surface/95 ring-2 ring-primary shadow-2xl scale-[1.02] z-50'
                : 'bg-surface/70 hover:bg-surface border-border hover:border-primary/40 hover:shadow-md transition-colors'
            }`}
          >
            {/* Card Top Row: Name + Hover Menu */}
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-bold text-[13.5px] text-text-main leading-snug line-clamp-2 hover:text-primary transition-colors">
                {deal.title}
              </h4>

              <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded-xl shadow-xl p-1 min-w-[140px]"
                    >
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onNavigate();
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-text-main hover:bg-surface-hover rounded-lg flex items-center gap-2"
                      >
                        <Edit2 className="w-3 h-3" /> View / Edit
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onMarkWon();
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded-lg flex items-center gap-2"
                      >
                        <Trophy className="w-3 h-3" /> Mark Won
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onMarkLost();
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2"
                      >
                        <XCircle className="w-3 h-3" /> Mark Lost
                      </button>
                      <div className="h-[1px] bg-border my-1" />
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete();
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Value */}
            {cardConfig.showValue && (
              <div className="text-[15px] font-extrabold font-mono text-emerald-400 mt-1.5">
                ${deal.amount.toLocaleString()}
              </div>
            )}

            {/* Contact Row */}
            {cardConfig.showContact && deal.contact && (
              <div className="flex items-center gap-2 mt-2 text-xs text-text-muted">
                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                  {deal.contact.firstName[0]}
                </div>
                <span className="truncate">{deal.contact.firstName} {deal.contact.lastName || ''}</span>
              </div>
            )}

            {/* Tag Pills */}
            {cardConfig.showTags && deal.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2.5">
                {deal.tags.slice(0, 3).map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-surface-hover/80 border border-border text-[10px] text-text-muted font-medium"
                  >
                    {tag}
                  </span>
                ))}
                {deal.tags.length > 3 && (
                  <span className="text-[10px] text-text-muted px-1">+{deal.tags.length - 3}</span>
                )}
              </div>
            )}

            {/* Custom Field Chips */}
            {cardConfig.showCustomFields && cardConfig.visibleCustomFieldIds && cardConfig.visibleCustomFieldIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/40">
                {cardConfig.visibleCustomFieldIds.map(fId => {
                  const val = deal.customFields?.[fId];
                  if (!val) return null;
                  const def = customFields.find(f => f.id === fId);
                  return (
                    <span key={fId} className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] text-text-muted">
                      <strong className="text-text-main">{def?.label || fId}:</strong> {String(val)}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Card Footer: Days in Stage + Owner Avatar */}
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/40 text-[11px] text-text-muted">
              {cardConfig.showDaysInStage && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isStale
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-surface-hover text-text-muted'
                  }`}
                  title={`In stage for ${deal.daysInStage} days`}
                >
                  <Clock className="w-2.5 h-2.5" />
                  {deal.daysInStage}d in stage
                </span>
              )}

              {cardConfig.showOwner && deal.ownerId && (
                <div className="w-5 h-5 rounded-full bg-primary/30 text-text-main font-bold text-[9px] flex items-center justify-center ml-auto">
                  {deal.ownerId[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
          </div>
        );
      }}
    </Draggable>
  );
}

function parseJsonSafe<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}
