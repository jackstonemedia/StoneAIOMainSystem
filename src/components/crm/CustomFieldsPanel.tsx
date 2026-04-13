import React, { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'url';

export interface CustomField {
  id: string;
  label: string;
  type: FieldType;
  value: string;
  options?: string[]; // for dropdown
}

interface CustomFieldsPanelProps {
  entityId: string;
  entityType: 'contact' | 'company' | 'deal';
}

const FIELD_TYPE_ICONS: Record<FieldType, string> = {
  text: 'T',
  number: '#',
  date: '📅',
  dropdown: '▾',
  checkbox: '☑',
  url: '🔗',
};

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'url', label: 'URL' },
];

function storageKey(entityType: string, entityId: string) {
  return `crm_custom_fields_${entityType}_${entityId}`;
}

export default function CustomFieldsPanel({ entityId, entityType }: CustomFieldsPanelProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<FieldType>('text');
  const [typeDropOpen, setTypeDropOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey(entityType, entityId));
    if (saved) setFields(JSON.parse(saved));
  }, [entityId, entityType]);

  const persist = (updated: CustomField[]) => {
    setFields(updated);
    localStorage.setItem(storageKey(entityType, entityId), JSON.stringify(updated));
  };

  const addField = () => {
    if (!newLabel.trim()) return;
    const field: CustomField = {
      id: `cf-${Date.now()}`,
      label: newLabel.trim(),
      type: newType,
      value: newType === 'checkbox' ? 'false' : '',
    };
    persist([...fields, field]);
    setNewLabel('');
    setNewType('text');
    setAdding(false);
  };

  const updateValue = (id: string, value: string) => {
    persist(fields.map(f => f.id === id ? { ...f, value } : f));
  };

  const removeField = (id: string) => {
    persist(fields.filter(f => f.id !== id));
  };

  const renderInput = (field: CustomField) => {
    const base = 'flex-1 bg-surface-hover border border-border rounded-lg px-2.5 py-1.5 text-[13px] text-text-main focus:outline-none focus:ring-2 focus:ring-[#52677D]/30 focus:border-[#52677D]/50 transition-all';
    switch (field.type) {
      case 'checkbox':
        return (
          <input type="checkbox" checked={field.value === 'true'}
            onChange={e => updateValue(field.id, e.target.checked ? 'true' : 'false')}
            className="w-4 h-4 rounded border-border text-[#52677D] focus:ring-[#52677D]/30 cursor-pointer" />
        );
      case 'number':
        return <input type="number" value={field.value} onChange={e => updateValue(field.id, e.target.value)} className={base} placeholder="0" />;
      case 'date':
        return <input type="date" value={field.value} onChange={e => updateValue(field.id, e.target.value)} className={base} />;
      case 'url':
        return <input type="url" value={field.value} onChange={e => updateValue(field.id, e.target.value)} className={base} placeholder="https://" />;
      default:
        return <input type="text" value={field.value} onChange={e => updateValue(field.id, e.target.value)} className={base} placeholder="—" />;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Custom Fields</h3>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-[11px] font-semibold text-[#52677D] hover:bg-[#52677D] px-2 py-1 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add field
        </button>
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {fields.map(field => (
            <motion.div key={field.id}
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 group">
              <div className="cursor-grab text-text-muted hover:text-text-muted shrink-0">
                <GripVertical className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-semibold text-text-muted0 w-24 shrink-0 truncate">{field.label}</span>
              <span className="text-[10px] font-bold bg-surface-hover text-text-muted px-1.5 py-0.5 rounded shrink-0">{FIELD_TYPE_ICONS[field.type]}</span>
              {renderInput(field)}
              <button onClick={() => removeField(field.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-6 h-6 flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-50 rounded">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {fields.length === 0 && !adding && (
          <p className="text-[12px] text-text-muted italic text-center py-2">No custom fields yet. Click "Add field" to create one.</p>
        )}
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="mt-3 p-3 bg-[#52677D] border border-border rounded-xl space-y-2">
            <div className="flex gap-2">
              <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addField(); if (e.key === 'Escape') setAdding(false); }}
                placeholder="Field label (e.g. LinkedIn, Industry...)"
                className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-text-main focus:outline-none focus:ring-2 focus:ring-[#52677D]/30 focus:border-[#52677D]/50" />
              <div className="relative">
                <button onClick={() => setTypeDropOpen(o => !o)}
                  className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-3 py-2 text-[13px] font-medium text-text-main hover:bg-surface-hover transition-colors">
                  {FIELD_TYPE_ICONS[newType]} {FIELD_TYPES.find(t => t.value === newType)?.label}
                  <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                </button>
                <AnimatePresence>
                  {typeDropOpen && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="absolute top-full right-0 mt-1 z-50 bg-surface border border-border rounded-xl shadow-xl py-1.5 min-w-[140px]">
                      {FIELD_TYPES.map(t => (
                        <button key={t.value} onClick={() => { setNewType(t.value); setTypeDropOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 hover:bg-surface-hover transition-colors ${newType === t.value ? 'text-[#52677D] font-semibold' : 'text-text-main'}`}>
                          <span>{FIELD_TYPE_ICONS[t.value]}</span> {t.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-[12px] font-semibold text-text-muted0 hover:bg-surface-hover rounded-lg transition-colors">Cancel</button>
              <button onClick={addField} disabled={!newLabel.trim()}
                className="px-4 py-1.5 text-[12px] font-semibold bg-[#52677D] text-white rounded-lg hover:bg-[#52677D] transition-colors disabled:opacity-40">
                Add Field
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
