commit 1af49f928634771d811121ee788ac1645185dab0
Author: jackstonemedia <mediajackstone@gmail.com>
Date:   Fri Jun 5 21:54:01 2026 -0400

    feat: add marketing builder, AI design modal, dashboard metrics, CRM pipeline config, activity log, and campaign improvements

diff --git a/src/pages/crm/Opportunities.tsx b/src/pages/crm/Opportunities.tsx
index bfcc54f..7f5597d 100644
--- a/src/pages/crm/Opportunities.tsx
+++ b/src/pages/crm/Opportunities.tsx
@@ -1,17 +1,23 @@
-import React, { useState, useEffect } from 'react';
+import React, { useState, useEffect, useCallback } from 'react';
 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { motion, AnimatePresence } from 'motion/react';
-import { Draggable } from '@hello-pangea/dnd';
+import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
 import { InvoiceModal } from '../../components/crm/InvoiceModal';
+import { apiClient } from '../../lib/apiClient';
 import {
-  Plus, Search, Filter, ChevronDown, MoreVertical, X,
-  List, Download, Phone, Mail, MessageSquare,
-  Calendar, CheckSquare, Trash2, Edit2, GripVertical,
-  Settings, ChevronLeft,
-  AlertCircle, Check, Target, TrendingUp, Zap,
-  PlayCircle, PauseCircle, CheckCircle2,
-  XCircle, Activity, GitBranch
+  Plus, Search, ChevronDown, X,
+  List, MessageSquare,
+  Trash2, Edit2, GripVertical,
+  ChevronLeft,
+  AlertCircle, Check, Target,
+  CheckCircle2,
+  XCircle, LayoutGrid,
+  Sparkles, UserPlus, User, Building2,
+  Phone, Mail, CheckSquare, Calendar, GitBranch,
+  TrendingUp, MoreVertical, Activity, PauseCircle,
+  Zap, PlayCircle
 } from 'lucide-react';
+import KanbanBoard from '../../components/crm/KanbanBoard';
 
 // ΓöÇΓöÇΓöÇ Types ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
 
@@ -36,6 +42,50 @@ function fmt(n: number) {
   return `$${n.toLocaleString()}`;
 }
 
+const TEXT_COLORS: Record<string, string> = {
+  '#F8BBD0': '#880E4F', // Pink
+  '#B3E5FC': '#01579B', // Blue
+  '#E1BEE7': '#4A148C', // Purple
+  '#C8E6C9': '#1B5E20', // Green
+  '#FFCCBC': '#BF360C', // Orange
+  '#FFF9C4': '#F57F17', // Yellow
+  '#F5F5F5': '#424242',
+  '#E0E0E0': '#212121',
+};
+
+function getDarkTextColor(hex: string) {
+  if (!hex || !hex.startsWith('#')) return '#1e293b';
+  const upper = hex.toUpperCase();
+  if (TEXT_COLORS[upper]) return TEXT_COLORS[upper];
+  
+  // Fallback for custom colors
+  let r = 0, g = 0, b = 0;
+  if (hex.length === 4) {
+    r = parseInt(hex[1] + hex[1], 16);
+    g = parseInt(hex[2] + hex[2], 16);
+    b = parseInt(hex[3] + hex[3], 16);
+  } else if (hex.length === 7) {
+    r = parseInt(hex.substring(1, 3), 16);
+    g = parseInt(hex.substring(3, 5), 16);
+    b = parseInt(hex.substring(5, 7), 16);
+  }
+  r /= 255; g /= 255; b /= 255;
+  const max = Math.max(r, g, b), min = Math.min(r, g, b);
+  let h = 0, s = 0, l = (max + min) / 2;
+  if (max !== min) {
+    const d = max - min;
+    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
+    switch (max) {
+      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
+      case g: h = (b - r) / d + 2; break;
+      case b: h = (r - g) / d + 4; break;
+    }
+    h /= 6;
+  }
+  s = Math.min(1, s * 1.5);
+  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, 22%)`;
+}
+
 async function apiFetch<T>(url: string): Promise<T> {
   const r = await fetch(url); if (!r.ok) throw new Error('Failed'); return r.json();
 }
@@ -281,7 +331,7 @@ function PipelineModal({ pipeline, onClose, onSave }: { pipeline?: Pipeline | nu
           await fetch(`/api/crm/pipelines/${pipeline.id}/stages/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: s.name, order: s.order }) });
         }
       } else {
-        const r = await fetch('/api/crm/pipelines/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, stages: stages.map((s, i) => ({ name: s.name, color: s.color, order: i, probability: s.probability })) }) });
+        const r = await fetch('/api/crm/pipelines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, stages: stages.map((s, i) => ({ name: s.name, color: s.color, order: i, probability: s.probability })) }) });
         if (!r.ok) throw new Error('Failed');
       }
       qc.invalidateQueries({ queryKey: ['pipelines'] });
@@ -809,6 +859,19 @@ export default function Opportunities() {
   const [selected, setSelected] = useState<Set<string>>(new Set());
   const [sortDropOpen, setSortDropOpen] = useState(false);
   const [invoiceDeal, setInvoiceDeal] = useState<{ id: string; amount: number } | null>(null);
+  const [view, setView] = useState<'list' | 'kanban'>('list');
+  
+  // Inline editing state
+  const [editingStageId, setEditingStageId] = useState<string | null>(null);
+  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
+  const [addingGroup, setAddingGroup] = useState(false);
+  
+  const PASTEL_COLORS = [
+    '#FFF59D', '#FFCC80', '#FFCDD2', '#F48FB1', '#F8BBD0', '#E1BEE7',
+    '#E6EE9C', '#C5E1A5', '#A5D6A7', '#80CBC4', '#80DEEA', '#B2DFDB',
+    '#C5CAE9', '#D1C4E9', '#E1BEE7', '#CE93D8', '#9FA8DA', '#90CAF9',
+    '#81D4FA', '#B3E5FC', '#4DD0E1', '#90CAF9', '#CFD8DC', '#B0BEC5'
+  ];
 
   const { data: pipelines = [], isLoading: loadingPipelines } = useQuery<Pipeline[]>({ queryKey: ['pipelines'], queryFn: () => apiFetch('/api/crm/pipelines') });
   const { data: rawDeals = [], isLoading: loadingDeals } = useQuery<Deal[]>({ queryKey: ['deals'], queryFn: () => apiFetch('/api/crm/deals') });
@@ -829,73 +892,130 @@ export default function Opportunities() {
     onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
   });
 
+  const updateStage = async (stageId: string, updates: any) => {
+    try {
+      let pId = selectedPipelineId;
+      if (pId === 'all') {
+        const p = pipelines.find(p => p.stages?.some(s => s.id === stageId));
+        if (p) pId = p.id;
+      }
+      if (!pId || pId === 'all') return;
+      await apiClient.put(`/crm/pipelines/${pId}/stages/${stageId}`, updates);
+      qc.invalidateQueries({ queryKey: ['pipelines'] });
+    } catch (e) { console.error(e); }
+  };
+
+  const addNewGroup = async () => {
+    setAddingGroup(true);
+    try {
+      let pId = selectedPipelineId;
+      if (pId === 'all') pId = pipelines[0]?.id;
+      if (!pId || pId === 'all') return;
+      
+      const newColor = PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
+      await apiClient.post(`/crm/pipelines/${pId}/stages`, {
+        name: 'New Group',
+        color: newColor,
+        order: 99,
+        probability: 50
+      });
+      qc.invalidateQueries({ queryKey: ['pipelines'] });
+    } catch (e) { console.error(e); }
+    finally { setAddingGroup(false); }
+  };
+
+  const moveDealToStage = useCallback(async (dealId: string, stageId: string) => {
+    try {
+      await fetch(`/api/crm/deals/${dealId}`, {
+        method: 'PUT',
+        headers: { 'Content-Type': 'application/json' },
+        body: JSON.stringify({ pipelineStageId: stageId }),
+      });
+      qc.invalidateQueries({ queryKey: ['deals'] });
+    } catch (e) { console.error(e); }
+  }, [qc]);
+
+  const onDragEnd = useCallback((result: DropResult) => {
+    const { draggableId, destination } = result;
+    if (!destination) return;
+    const targetStageId = destination.droppableId;
+    const deal = rawDeals.find(d => d.id === draggableId) as any;
+    const currentStageId = deal?.pipelineStageId || deal?.pipelineStage?.id;
+    if (targetStageId !== currentStageId) {
+      moveDealToStage(draggableId, targetStageId);
+    }
+  }, [rawDeals, moveDealToStage]);
+
   const toggleSelect = (id: string) => { setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
   const toggleAll = () => { if (selected.size === deals.length && deals.length > 0) setSelected(new Set()); else setSelected(new Set(deals.map(d => d.id))); };
 
   const isLoading = loadingPipelines || loadingDeals;
   const AVATAR_COLORS = ['#4F8EF7', '#52C27E', '#F5A623', '#9B59B6', '#E74C3C', '#1ABC9C', '#3498DB', '#E67E22'];
 
+  const groupedDeals = allStages.map(stage => {
+    const stageDeals = deals.filter(deal => {
+      const raw = rawDeals.find(d => d.id === deal.id) as any;
+      const stageId = raw?.pipelineStageId || raw?.pipelineStage?.id;
+      return stageId === stage.id;
+    });
+    return { stage, deals: stageDeals };
+  });
+  
+  const unassignedDeals = deals.filter(deal => {
+    const raw = rawDeals.find(d => d.id === deal.id) as any;
+    const stageId = raw?.pipelineStageId || raw?.pipelineStage?.id;
+    return !allStages.find(s => s.id === stageId);
+  });
+  
+  if (unassignedDeals.length > 0) {
+    groupedDeals.push({ stage: { id: 'unassigned', name: 'Unassigned', color: '#888888', order: 999, probability: 0 }, deals: unassignedDeals });
+  }
+
   return (
     <div className="flex flex-col h-full w-full bg-bg relative">
 
-      {/* ΓöÇΓöÇ Toolbar ΓÇö exact Contacts layout ΓöÇΓöÇ */}
-      <div className="px-8 flex items-center justify-between border-b border-border bg-surface relative shadow-[0_4px_16px_rgba(0,0,0,0.03)] h-[73px] shrink-0">
-        <div className="flex items-center gap-2">
-          {/* All pill */}
-          <button
-            onClick={() => setSelectedPipelineId('all')}
-            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors text-[13px] font-medium ${
-              selectedPipelineId === 'all'
-                ? 'text-text-main bg-surface-hover border-border'
-                : 'text-text-muted bg-surface border-border/60 hover:text-text-main hover:bg-surface-hover hover:border-border'
-            }`}
-          >
-            <List className="w-3.5 h-3.5 text-primary" /><span>All</span>
-          </button>
-          {/* Pipeline pills */}
-          {pipelines.map(p => (
-            <button key={p.id} onClick={() => setSelectedPipelineId(p.id)}
-              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors text-[13px] font-medium ${
-                selectedPipelineId === p.id
-                  ? 'text-text-main bg-surface-hover border-border'
-                  : 'text-text-muted bg-surface border-border/60 hover:text-text-main hover:bg-surface-hover hover:border-border'
-              }`}
-            >{p.name}</button>
-          ))}
-
-          <div className="w-[1px] h-5 bg-border mx-2" />
-
-          <button className="btn-secondary"><Filter className="w-4 h-4" /> Advanced filters</button>
-
-          <div className="relative">
-            <button onClick={() => setSortDropOpen(o => !o)} className="btn-secondary"><ChevronDown className="w-4 h-4" /> Sort</button>
-            <AnimatePresence>
-              {sortDropOpen && (
-                <>
-                  <div className="fixed inset-0 z-40" onClick={() => setSortDropOpen(false)} />
-                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
-                    className="absolute left-0 mt-2 w-[180px] bg-surface border border-border/50 shadow-luxury rounded-xl overflow-hidden py-1 z-50 ring-1 ring-white/5"
-                  >
-                    {['Newest First', 'Oldest First', 'Value (High ΓåÆ Low)', 'Value (Low ΓåÆ High)', 'Name (AΓÇôZ)'].map(opt => (
-                      <button key={opt} onClick={() => setSortDropOpen(false)} className="w-full flex items-center px-4 py-2 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">{opt}</button>
-                    ))}
-                  </motion.div>
-                </>
-              )}
-            </AnimatePresence>
+      {/* ΓöÇΓöÇ Top Header ΓöÇΓöÇ */}
+      <div className="flex-none px-8 py-5 border-b border-border bg-surface flex items-center justify-between sticky top-0 z-10 shadow-sm">
+        <div className="flex items-center gap-4">
+          <div className="flex items-center gap-2">
+            <h1 className="text-[20px] font-bold text-text-main flex items-center">
+              Opportunities
+            </h1>
+            <span className="text-text-muted text-[13px] font-medium ml-1">
+              Manage your sales pipeline and track deal progress.
+            </span>
           </div>
+          {pipelines.length > 1 && (
+            <div className="relative group ml-4">
+              <select
+                value={selectedPipelineId}
+                onChange={e => setSelectedPipelineId(e.target.value)}
+                className="appearance-none bg-surface-hover/50 border border-border rounded-lg pl-3 pr-8 py-1.5 text-[13px] font-medium text-text-main focus:outline-none focus:border-primary cursor-pointer hover:bg-surface-hover transition-colors"
+              >
+                <option value="all">All Pipelines</option>
+                {pipelines.map(p => (
+                  <option key={p.id} value={p.id}>{p.name}</option>
+                ))}
+              </select>
+              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none group-hover:text-text-main transition-colors" />
+            </div>
+          )}
         </div>
-
         <div className="flex items-center gap-3">
-          <div className="relative shadow-sm rounded-full flex items-center mr-2">
-            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
-            <input type="text" placeholder="Search Opportunities" value={search} onChange={e => setSearch(e.target.value)}
-              className="pl-9 pr-4 py-1.5 w-[200px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted" />
-          </div>
-          <button className="btn-secondary"><Download className="w-4 h-4" /> Import</button>
-          <button onClick={() => setAddModalOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Opportunity</button>
-          <div className="w-[1px] h-5 bg-border mx-1" />
-          <button onClick={() => setPipelinesOpen(true)} className="btn-secondary"><Settings className="w-4 h-4" /> Pipeline Config</button>
+           <button onClick={() => setPipelinesOpen(true)} className="btn-secondary">
+             Pipeline Settings
+           </button>
+           <button onClick={() => setAddModalOpen(true)} className="btn-primary">
+             <Plus className="w-4 h-4 mr-1" /> Create Opportunity
+           </button>
+           <div className="flex items-center border border-border rounded-lg bg-surface-hover/30 p-1 ml-2 shadow-sm">
+             <button onClick={() => setView('list')} className={`p-1.5 rounded-[6px] transition-all duration-200 ${view === 'list' ? 'bg-surface shadow-sm text-text-main border border-border/50' : 'text-text-muted hover:text-text-main'}`}>
+               <List className="w-4 h-4" />
+             </button>
+             <button onClick={() => setView('kanban')} className={`p-1.5 rounded-[6px] transition-all duration-200 ${view === 'kanban' ? 'bg-surface shadow-sm text-text-main border border-border/50' : 'text-text-muted hover:text-text-main'}`}>
+               <LayoutGrid className="w-4 h-4" />
+             </button>
+           </div>
         </div>
       </div>
 
@@ -904,75 +1024,266 @@ export default function Opportunities() {
         <div className="flex-1 flex items-center justify-center">
           <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
         </div>
+      ) : view === 'kanban' ? (
+        <div className="flex-1 overflow-hidden mx-8 mt-4 mb-6 rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 relative">
+          <KanbanBoard
+            deals={deals.map(d => {
+              const raw = rawDeals.find(rd => rd.id === d.id) as any;
+              const stageId = raw?.pipelineStageId || raw?.pipelineStage?.id;
+              const stage = stageMap.get(stageId);
+              return { ...d, stage: stage?.name || 'Unknown' } as any;
+            })}
+            stages={selectedPipelineId === 'all' ? allStages : (pipelines.find(p => p.id === selectedPipelineId)?.stages || [])}
+            onDealMove={(dealId, stageName) => {
+              const stage = allStages.find(s => s.name === stageName);
+              if (stage) {
+                fetch(`/api/crm/deals/${dealId}`, {
+                  method: 'PUT',
+                  headers: { 'Content-Type': 'application/json' },
+                  body: JSON.stringify({ pipelineStageId: stage.id })
+                }).then(() => qc.invalidateQueries({ queryKey: ['deals'] }));
+              }
+            }}
+            onDealDelete={(dealId) => deleteDeal.mutate(dealId)}
+            onDealEdit={(dealId) => setEditingDeal(rawDeals.find(d => d.id === dealId) as Deal)}
+            onAddDeal={(stageName) => setAddModalOpen(true)}
+          />
+        </div>
       ) : (
-        <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 relative">
-          <table className="w-full text-left">
-            <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
-              <tr>
-                <th className="w-12 p-3 text-center">
-                  <button onClick={toggleAll} className="w-4 h-4 border border-border rounded flex items-center justify-center transition-colors bg-bg hover:border-primary text-primary">
-                    {selected.size === deals.length && deals.length > 0 ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
-                  </button>
-                </th>
-                {['Opportunity', 'Contact', 'Pipeline / Stage', 'Value', 'Status', 'Created (EDT)', 'Last activity (EDT)'].map(h => (
-                  <th key={h} className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
-                    <div className="flex items-center gap-2">{h} <ChevronDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100 cursor-pointer transition-opacity" /></div>
-                  </th>
-                ))}
-              </tr>
-            </thead>
-            <tbody>
-              {deals.length === 0 ? (
-                <tr><td colSpan={8} className="py-24" /></tr>
-              ) : deals.map(deal => {
-                const raw = rawDeals.find(d => d.id === deal.id) as any;
-                const stageId = (raw as any)?.pipelineStageId || raw?.pipelineStage?.id;
-                const stage = stageMap.get(stageId);
-                const contactName = raw?.contact ? `${raw.contact.firstName || ''} ${raw.contact.lastName || ''}`.trim() || 'ΓÇö' : 'ΓÇö';
-                const initials = deal.title.substring(0, 2).toUpperCase();
-                const avatarColor = AVATAR_COLORS[deal.title.charCodeAt(0) % AVATAR_COLORS.length];
-                return (
-                  <tr key={deal.id}
-                    className={`border-b border-border/50 transition-colors cursor-pointer ${selected.has(deal.id) ? 'bg-primary/5' : 'hover:bg-surface-hover/50'}`}
-                    onClick={() => setEditingDeal(raw as Deal)}
-                  >
-                    <td className="p-3 text-center" onClick={e => { e.stopPropagation(); toggleSelect(deal.id); }}>
-                      <button className="w-4 h-4 border border-border bg-bg rounded flex items-center justify-center transition-colors hover:border-primary text-primary">
-                        {selected.has(deal.id) ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
-                      </button>
-                    </td>
-                    <td className="p-3">
-                      <div className="flex items-center gap-3">
-                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm shrink-0" style={{ backgroundColor: avatarColor }}>
-                          {initials}
-                        </div>
-                        <span className="text-[13px] font-medium text-text-main truncate">{deal.title}</span>
-                      </div>
-                    </td>
-                    <td className="p-3 text-[13px] font-medium text-text-main">{contactName}</td>
-                    <td className="p-3">
-                      {stage
-                        ? <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-semibold" style={{ background: `${stage.color}22`, color: stage.color }}>{stage.name}</span>
-                        : <span className="text-[12px] text-text-muted">ΓÇö</span>}
-                    </td>
-                    <td className="p-3 text-[13px] font-bold text-text-main">${(deal.amount || 0).toLocaleString()}</td>
-                    <td className="p-3">
-                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${raw?.status === 'won' ? 'bg-emerald-400/10 text-emerald-400' : raw?.status === 'lost' ? 'bg-red-400/10 text-red-400' : 'bg-primary/10 text-primary'}`}>
-                        {raw?.status || 'open'}
-                      </span>
-                    </td>
-                    <td className="p-3 text-[11px] font-medium whitespace-nowrap text-text-muted opacity-60">
-                      {deal.createdAt ? new Date(deal.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'ΓÇö'}
-                    </td>
-                    <td className="p-3 text-[11px] font-medium whitespace-nowrap text-text-muted opacity-60">
-                      {(raw as any)?.updatedAt ? new Date((raw as any).updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'ΓÇö'}
-                    </td>
-                  </tr>
-                );
-              })}
-            </tbody>
-          </table>
+        <DragDropContext onDragEnd={onDragEnd}>
+          <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 relative">
+            <div className="flex flex-col gap-10">
+            {groupedDeals.map(group => {
+              const groupTotal = group.deals.reduce((sum, d) => sum + (d.amount || 0), 0);
+              return (
+                <div key={group.stage.id} className="flex flex-col">
+                  {/* Group Header */}
+                  <div className="flex items-center gap-2 mb-2 ml-1 relative">
+                    <ChevronDown className="w-5 h-5 transition-transform cursor-pointer" style={{ color: group.stage.color }} />
+                    <div className="relative">
+                      {editingStageId === group.stage.id ? (
+                        <input
+                          autoFocus
+                          defaultValue={group.stage.name}
+                          onBlur={(e) => {
+                            if (e.target.value !== group.stage.name) updateStage(group.stage.id, { name: e.target.value });
+                            setEditingStageId(null);
+                          }}
+                          onKeyDown={(e) => {
+                            if (e.key === 'Enter') {
+                              if (e.currentTarget.value !== group.stage.name) updateStage(group.stage.id, { name: e.currentTarget.value });
+                              setEditingStageId(null);
+                            } else if (e.key === 'Escape') {
+                              setEditingStageId(null);
+                            }
+                          }}
+                          className="text-[18px] font-semibold bg-surface-hover border border-border rounded px-1 -ml-1 focus:outline-none focus:border-primary"
+                          style={{ color: group.stage.color, width: '200px' }}
+                        />
+                      ) : (
+                        <h3 
+                          className="text-[18px] font-semibold cursor-text hover:opacity-80 transition-opacity" 
+                          style={{ color: group.stage.color }}
+                          onClick={() => setEditingStageId(group.stage.id)}
+                        >
+                          {group.stage.name}
+                        </h3>
+                      )}
+                    </div>
+                    
+                    <button 
+                      onClick={() => setActiveColorPicker(activeColorPicker === group.stage.id ? null : group.stage.id)}
+                      className="w-5 h-5 rounded-full border-2 border-surface ml-2 shadow-sm cursor-pointer hover:scale-110 transition-transform relative"
+                      style={{ backgroundColor: group.stage.color }}
+                    />
+                    
+                    {/* Inline Color Picker Popover */}
+                    <AnimatePresence>
+                      {activeColorPicker === group.stage.id && (
+                        <>
+                          <div className="fixed inset-0 z-10" onClick={() => setActiveColorPicker(null)} />
+                          <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
+                            className="absolute left-[calc(100%+8px)] top-0 bg-surface border border-border shadow-luxury rounded-xl p-3 z-20 w-[220px]"
+                          >
+                            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Stage Color</div>
+                            <div className="grid grid-cols-6 gap-2">
+                              {PASTEL_COLORS.map(color => (
+                                <button key={color} onClick={() => { updateStage(group.stage.id, { color }); setActiveColorPicker(null); }}
+                                  className="w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform border border-black/10"
+                                  style={{ backgroundColor: color }}
+                                />
+                              ))}
+                            </div>
+                          </motion.div>
+                        </>
+                      )}
+                    </AnimatePresence>
+                  </div>
+                  
+                  {/* Table Wrapper */}
+                  <div className="bg-surface/40 backdrop-blur-2xl border border-border/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[12px] overflow-hidden">
+                    <table className="w-full text-left text-[13px] border-collapse">
+                      <thead className="border-b border-border bg-surface-hover/50">
+                        <tr>
+                          <th className="w-8 text-center border-r border-border relative"><div className="w-[6px] h-full absolute left-0 top-0 bottom-0" style={{ backgroundColor: group.stage.color }} /></th>
+                          <th className="w-10 text-center border-r border-border"><input type="checkbox" className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5" /></th>
+                          <th className="p-2 border-r border-border font-medium text-text-main w-[240px]">Deal</th>
+                          <th className="p-2 border-r border-border font-medium text-text-muted text-center w-[120px]">Activities time...</th>
+                          <th className="p-2 border-r border-border font-medium text-text-muted text-center w-[140px]">Stage</th>
+                          <th className="p-2 border-r border-border font-medium text-text-muted text-center w-[100px]">Owner</th>
+                          <th className="p-2 border-r border-border font-medium text-text-muted text-center w-[120px]">Deal Value</th>
+                          <th className="p-2 border-r border-border font-medium text-text-muted text-center w-[160px]">Contacts</th>
+                          <th className="p-2 border-r border-border font-medium text-text-muted text-center w-[160px]">Accounts</th>
+                          <th className="p-2 border-r border-border font-medium text-text-muted text-center w-8"><Plus className="w-4 h-4 inline-block opacity-50" /></th>
+                        </tr>
+                      </thead>
+                      <Droppable droppableId={group.stage.id}>
+                        {(provided, snapshot) => (
+                          <tbody
+                            ref={provided.innerRef}
+                            {...provided.droppableProps}
+                            className={`transition-colors duration-150 ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
+                          >
+                            {group.deals.map((deal, index) => {
+                              const raw = rawDeals.find(d => d.id === deal.id) as any;
+                              const contactName = raw?.contact ? `${raw.contact.firstName || ''} ${raw.contact.lastName || ''}`.trim() : 'ΓÇö';
+                              return (
+                                <Draggable key={deal.id} draggableId={deal.id} index={index}>
+                                  {(drag, dragSnapshot) => (
+                                    <tr
+                                      ref={drag.innerRef}
+                                      {...drag.draggableProps}
+                                      style={{ 
+                                        ...drag.draggableProps.style, 
+                                        display: dragSnapshot.isDragging ? 'table' : '',
+                                        tableLayout: dragSnapshot.isDragging ? 'fixed' : '',
+                                        width: dragSnapshot.isDragging ? '1144px' : '',
+                                        background: dragSnapshot.isDragging ? 'var(--surface)' : '',
+                                        zIndex: dragSnapshot.isDragging ? 9999 : 'auto'
+                                      }}
+                                      className={`border-b border-border group/row cursor-pointer transition-colors ${dragSnapshot.isDragging ? 'shadow-2xl ring-1 ring-border shadow-black/20' : 'hover:bg-surface-hover/30'}`}
+                                      onClick={() => setEditingDeal(raw as Deal)}
+                                    >
+                                      <td className="w-8 text-center border-r border-border relative" onClick={e => e.stopPropagation()}>
+                                        <div className="w-[6px] absolute left-0 top-0 bottom-0" style={{ backgroundColor: group.stage.color }} />
+                                        <div
+                                          {...drag.dragHandleProps}
+                                          className="flex items-center justify-center h-full min-h-[36px] cursor-grab active:cursor-grabbing opacity-0 group-hover/row:opacity-60 hover:opacity-100 transition-opacity"
+                                          onClick={e => e.stopPropagation()}
+                                        >
+                                          <GripVertical className="w-3.5 h-3.5 text-text-muted" />
+                                        </div>
+                                      </td>
+                                      <td className="w-10 text-center border-r border-border" onClick={e => e.stopPropagation()}>
+                                        <input type="checkbox" className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5" />
+                                      </td>
+                                      <td className="p-2 border-r border-border w-[240px]">
+                                        <div className="flex items-center justify-between">
+                                          <span className="font-medium text-text-main group-hover/row:underline truncate">{deal.title}</span>
+                                          <div className="flex items-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
+                                            <Sparkles className="w-3.5 h-3.5 text-primary cursor-pointer hover:scale-110 transition-transform" />
+                                            <MessageSquare className="w-3.5 h-3.5 text-text-muted hover:text-primary cursor-pointer" />
+                                          </div>
+                                        </div>
+                                      </td>
+                                      <td className="p-0 border-r border-border align-middle w-[120px]">
+                                        <div className="flex items-center justify-center gap-1 px-4">
+                                          <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden flex">
+                                            <div className="w-1/4 h-full bg-border/40 border-r border-bg"></div>
+                                            <div className="w-1/4 h-full bg-border/40 border-r border-bg"></div>
+                                            <div className="w-1/4 h-full bg-border/40 border-r border-bg"></div>
+                                            <div className="w-1/4 h-full bg-surface-hover"></div>
+                                          </div>
+                                        </div>
+                                      </td>
+                                      <td className="p-0 border-r border-border text-center w-[140px]">
+                                        <div className="w-full h-full min-h-[36px] flex items-center justify-center text-[12px] font-medium px-2" style={{ backgroundColor: group.stage.color, color: getDarkTextColor(group.stage.color) }}>
+                                          {group.stage.name}
+                                        </div>
+                                      </td>
+                                      <td className="p-0 border-r border-border align-middle w-[100px]">
+                                        <div className="flex justify-center items-center h-full min-h-[36px]">
+                                          <div className="w-7 h-7 rounded-full flex items-center justify-center bg-surface border border-border shadow-sm">
+                                            <User className="w-4 h-4 text-text-muted" />
+                                          </div>
+                                        </div>
+                                      </td>
+                                      <td className="p-2 border-r border-border text-center text-text-main w-[120px]">
+                                        ${(deal.amount || 0).toLocaleString()}
+                                      </td>
+                                      <td className="p-0 border-r border-border text-center align-middle relative group/cell w-[160px]">
+                                        <div className="absolute inset-0 bg-[#B3E5FC]/10 transition-colors group-hover/cell:bg-[#B3E5FC]/20 pointer-events-none" />
+                                        {contactName !== 'ΓÇö' ? (
+                                          <div className="w-full h-full min-h-[36px] flex items-center justify-center text-[#01579B] bg-[#B3E5FC] text-[12px] font-medium">
+                                            <div className="flex items-center gap-1.5 truncate px-1">
+                                              <UserPlus className="w-3.5 h-3.5 shrink-0" />
+                                              <span className="truncate">{contactName}</span>
+                                            </div>
+                                          </div>
+                                        ) : (
+                                          <div className="w-full h-full min-h-[36px] flex items-center justify-center">
+                                            <span className="text-[12px] text-text-muted opacity-50">ΓÇö</span>
+                                          </div>
+                                        )}
+                                      </td>
+                                      <td className="p-0 border-r border-border text-center align-middle relative group/cell w-[160px]">
+                                        <div className="absolute inset-0 bg-[#F8BBD0]/10 transition-colors group-hover/cell:bg-[#F8BBD0]/20 pointer-events-none" />
+                                        <div className="w-full h-full min-h-[36px] flex items-center justify-center text-[#880E4F] bg-[#F8BBD0] text-[12px] font-medium">
+                                          <div className="flex items-center gap-1.5">
+                                            <Building2 className="w-3.5 h-3.5" />
+                                            Account
+                                          </div>
+                                        </div>
+                                      </td>
+                                      <td className="p-2 border-r border-border text-center w-8"></td>
+                                    </tr>
+                                  )}
+                                </Draggable>
+                              );
+                            })}
+                            {provided.placeholder}
+                            {/* Add deal inline */}
+                            <tr className="group/add">
+                              <td colSpan={10} className="p-0 relative">
+                                <div className="w-[6px] absolute left-0 top-0 bottom-0" style={{ backgroundColor: group.stage.color }} />
+                                <div className="py-2.5 px-12 text-[13px] text-text-muted hover:text-text-main cursor-pointer transition-colors bg-surface/50 hover:bg-surface-hover flex items-center gap-1.5 border-t border-border/50" onClick={() => setAddModalOpen(true)}>
+                                  <Plus className="w-4 h-4 opacity-70 group-hover/add:opacity-100" /> Add deal
+                                </div>
+                              </td>
+                            </tr>
+                          </tbody>
+                        )}
+                      </Droppable>
+                      {/* Summary Row */}
+                      <tfoot>
+                        <tr className="border-t border-border bg-surface-hover/20">
+                          <td colSpan={6} className="border-r border-border relative h-[40px]">
+                            <div className="w-[6px] absolute left-0 top-0 bottom-0" style={{ backgroundColor: group.stage.color }} />
+                          </td>
+                          <td className="p-1 border-r border-border text-center">
+                            <div className="text-text-main font-semibold">${groupTotal.toLocaleString()}</div>
+                            <div className="text-[10px] text-text-muted font-medium">sum</div>
+                          </td>
+                          <td colSpan={3} className="border-r border-border"></td>
+                        </tr>
+                      </tfoot>
+                    </table>
+                  </div>
+                </div>
+              );
+            })}
+            
+            {/* Add New Group Button */}
+            <button 
+              onClick={addNewGroup}
+              disabled={addingGroup}
+              className="mt-2 ml-1 px-4 py-2 bg-surface text-text-main border border-border rounded shadow-sm font-medium text-[13px] hover:bg-surface-hover hover:border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-fit"
+            >
+              {addingGroup ? 'Adding group...' : '+ Add new group'}
+            </button>
+          </div>
         </div>
+        </DragDropContext>
       )}
 
       {/* ΓöÇΓöÇ Footer ΓÇö exact Contacts layout ΓöÇΓöÇ */}
