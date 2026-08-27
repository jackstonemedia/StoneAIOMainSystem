import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, Plus, Edit2, Trash2, Check, X,
  Layers, AlertCircle, ArrowUpDown, ChevronUp, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { opportunitiesApi } from '../../../lib/api/opportunities';
import { useToast } from '../../../components/ui/Toast';
import type { CustomField, Pipeline } from '../../../types/opportunities';

const FIELD_TYPES = [
  { id: 'text', label: 'Single Line Text' },
  { id: 'number', label: 'Numeric Value' },
  { id: 'currency', label: 'Currency ($)' },
  { id: 'date', label: 'Date Picker' },
  { id: 'select', label: 'Dropdown Select' },
  { id: 'multi-select', label: 'Multi-select List' },
  { id: 'checkbox', label: 'Checkbox (Yes/No)' },
  { id: 'url', label: 'Website / URL' },
];

export default function CustomFieldsSettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  // Modal form state
  const [label, setLabel] = useState('');
  const [type, setType] = useState<any>('text');
  const [scope, setScope] = useState<'all' | 'pipeline'>('all');
  const [pipelineId, setPipelineId] = useState<string>('');
  const [required, setRequired] = useState(false);
  const [optionsList, setOptionsList] = useState<string[]>(['Option 1', 'Option 2']);
  const [newOptionInput, setNewOptionInput] = useState('');

  const { data: customFields = [], isLoading } = useQuery<CustomField[]>({
    queryKey: ['opportunities-custom-fields'],
    queryFn: () => opportunitiesApi.listCustomFields(),
  });

  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ['opportunities-pipelines'],
    queryFn: () => opportunitiesApi.listPipelines(),
  });

  const saveFieldMut = useMutation({
    mutationFn: async () => {
      const optionsJson = (type === 'select' || type === 'dropdown' || type === 'multi-select')
        ? JSON.stringify(optionsList.filter(o => o.trim().length > 0))
        : null;

      if (editingFieldId) {
        return opportunitiesApi.updateCustomField(editingFieldId, {
          label,
          type,
          scope,
          pipelineId: scope === 'pipeline' ? pipelineId : null,
          required,
          optionsJson,
        });
      } else {
        return opportunitiesApi.createCustomField({
          label,
          type,
          scope,
          pipelineId: scope === 'pipeline' ? pipelineId : null,
          required,
          optionsJson,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-custom-fields'] });
      setShowModal(false);
      resetForm();
      toast('success', editingFieldId ? 'Field updated' : 'Field created');
    },
    onError: (err: any) => toast('error', 'Failed to save field', err.message),
  });

  const deleteFieldMut = useMutation({
    mutationFn: (id: string) => opportunitiesApi.deleteCustomField(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-custom-fields'] });
      toast('success', 'Custom field removed');
    },
    onError: (err: any) => toast('error', 'Failed to delete field', err.message),
  });

  const resetForm = () => {
    setEditingFieldId(null);
    setLabel('');
    setType('text');
    setScope('all');
    setPipelineId(pipelines[0]?.id || '');
    setRequired(false);
    setOptionsList(['Option 1', 'Option 2']);
    setNewOptionInput('');
  };

  const handleOpenEdit = (field: CustomField) => {
    setEditingFieldId(field.id);
    setLabel(field.label);
    setType(field.type);
    setScope(field.scope || 'all');
    setPipelineId(field.pipelineId || (pipelines[0]?.id || ''));
    setRequired(field.required);
    if (field.optionsJson) {
      try {
        setOptionsList(JSON.parse(field.optionsJson));
      } catch {
        setOptionsList([]);
      }
    }
    setShowModal(true);
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= customFields.length) return;
    const newFields = [...customFields];
    const temp = newFields[index];
    newFields[index] = newFields[targetIdx];
    newFields[targetIdx] = temp;
    await opportunitiesApi.reorderCustomFields(newFields.map(f => f.id));
    qc.invalidateQueries({ queryKey: ['opportunities-custom-fields'] });
  };

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      {/* Top Header */}
      <header className="px-8 py-4 border-b border-border bg-surface shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/opportunities"
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-[20px] font-bold text-text-main flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Custom Field Builder
            </h1>
            <p className="text-[12px] text-text-muted mt-0.5">
              Define custom data fields for opportunities, scoped globally or per-pipeline
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" /> New Field
        </button>
      </header>

      {/* Body Table */}
      <div className="flex-1 overflow-auto p-8 max-w-5xl">
        <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-text-muted text-sm">Loading custom fields...</div>
          ) : customFields.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-[16px] font-bold text-text-main">No Custom Fields</h3>
              <p className="text-[13px] text-text-muted max-w-sm mx-auto">
                Create custom fields to collect specific information on your deals (e.g. Contract Length, Industry, Project Scope).
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 mt-2"
              >
                <Plus className="w-4 h-4" /> Add First Field
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-hover/30 text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">Order</th>
                  <th className="py-3 px-4">Field Label</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Scope</th>
                  <th className="py-3 px-4">Default Required</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-[13px] text-text-main">
                {customFields.map((cf, idx) => {
                  const targetPipe = pipelines.find(p => p.id === cf.pipelineId);
                  return (
                    <tr key={cf.id} className="hover:bg-surface-hover/40 transition-colors">
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            disabled={idx === 0}
                            onClick={() => handleMoveOrder(idx, 'up')}
                            className="text-text-muted hover:text-text-main disabled:opacity-20 text-[10px]"
                          >
                            ▲
                          </button>
                          <button
                            disabled={idx === customFields.length - 1}
                            onClick={() => handleMoveOrder(idx, 'down')}
                            className="text-text-muted hover:text-text-main disabled:opacity-20 text-[10px]"
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold">{cf.label}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-surface-hover border border-border text-xs text-text-muted font-mono uppercase">
                          {cf.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {cf.scope === 'pipeline' && targetPipe ? (
                          <span className="text-xs text-primary font-medium">{targetPipe.name}</span>
                        ) : (
                          <span className="text-xs text-text-muted">All Pipelines</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {cf.required ? (
                          <span className="text-xs text-amber-400 font-semibold">Yes</span>
                        ) : (
                          <span className="text-xs text-text-muted">Optional</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(cf)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteFieldMut.mutate(cf.id)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* New / Edit Custom Field Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-[16px] font-bold text-text-main">
                  {editingFieldId ? 'Edit Custom Field' : 'Create Custom Field'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-text-muted hover:text-text-main">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Field Label *</label>
                  <input
                    type="text"
                    placeholder="e.g. Contract Duration (Months)"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Field Type *</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary cursor-pointer"
                  >
                    {FIELD_TYPES.map(ft => (
                      <option key={ft.id} value={ft.id}>{ft.label}</option>
                    ))}
                  </select>
                </div>

                {/* Dropdown Options manager */}
                {(type === 'select' || type === 'dropdown' || type === 'multi-select') && (
                  <div className="space-y-2 p-3 bg-surface-hover/30 border border-border rounded-xl">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Dropdown Options</label>
                    <div className="space-y-1.5">
                      {optionsList.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={opt}
                            onChange={e => {
                              const updated = [...optionsList];
                              updated[i] = e.target.value;
                              setOptionsList(updated);
                            }}
                            className="flex-1 px-2.5 py-1 bg-surface border border-border rounded-lg text-xs text-text-main"
                          />
                          <button
                            type="button"
                            onClick={() => setOptionsList(optionsList.filter((_, idx) => idx !== i))}
                            className="text-text-muted hover:text-red-400 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Add new option..."
                        value={newOptionInput}
                        onChange={e => setNewOptionInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newOptionInput.trim()) {
                            e.preventDefault();
                            setOptionsList([...optionsList, newOptionInput.trim()]);
                            setNewOptionInput('');
                          }
                        }}
                        className="flex-1 px-2.5 py-1 bg-surface border border-border rounded-lg text-xs text-text-main"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newOptionInput.trim()) {
                            setOptionsList([...optionsList, newOptionInput.trim()]);
                            setNewOptionInput('');
                          }
                        }}
                        className="px-2.5 py-1 bg-primary/20 hover:bg-primary/30 text-primary text-xs font-semibold rounded-lg"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Pipeline Scope</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setScope('all')}
                      className={`py-2 rounded-xl text-xs font-semibold border ${
                        scope === 'all' ? 'bg-primary text-white border-primary' : 'bg-surface-hover/40 text-text-muted border-border'
                      }`}
                    >
                      All Pipelines
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope('pipeline')}
                      className={`py-2 rounded-xl text-xs font-semibold border ${
                        scope === 'pipeline' ? 'bg-primary text-white border-primary' : 'bg-surface-hover/40 text-text-muted border-border'
                      }`}
                    >
                      Specific Pipeline
                    </button>
                  </div>
                </div>

                {scope === 'pipeline' && (
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-text-muted">Target Pipeline</label>
                    <select
                      value={pipelineId}
                      onChange={e => setPipelineId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main"
                    >
                      {pipelines.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <label className="flex items-center gap-2.5 p-3 bg-surface-hover/30 border border-border rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={required}
                    onChange={e => setRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-primary"
                  />
                  <div>
                    <span className="text-[13px] font-semibold text-text-main block">Default Required</span>
                    <span className="text-[11px] text-text-muted">Must be filled when creating opportunities</span>
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveFieldMut.mutate()}
                  disabled={!label.trim() || saveFieldMut.isPending}
                  className="px-5 py-2 bg-primary text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                >
                  {editingFieldId ? 'Save Changes' : 'Create Field'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
