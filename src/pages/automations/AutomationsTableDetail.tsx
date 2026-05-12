import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Loader2, Search, Save,
  Edit2, Check, X, ChevronDown, MoreHorizontal,
  Download, Upload,
} from 'lucide-react';
import {
  useTableDetail, useAddTableField, useDeleteTableField,
  useCreateRecord, useUpdateRecord, useDeleteRecord, useBulkDeleteRecords,
  useRenameTable,
} from '../../hooks/useTables';
import type { TableField, TableRecord } from '../../hooks/useTables';

const FIELD_TYPES = [
  { value: 'TEXT',             label: 'Text' },
  { value: 'NUMBER',           label: 'Number' },
  { value: 'DATE',             label: 'Date' },
  { value: 'CHECKBOX',         label: 'Checkbox' },
  { value: 'STATIC_DROPDOWN',  label: 'Select' },
];

export default function AutomationsTableDetail() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ recordId: string; fieldId: string } | null>(null);
  const [cellDraft, setCellDraft] = useState<string>('');
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('TEXT');
  const [renamingTable, setRenamingTable] = useState(false);
  const [tableNameDraft, setTableNameDraft] = useState('');

  const { data: table, isLoading } = useTableDetail(tableId!, { search: search || undefined, page });
  const addField    = useAddTableField();
  const deleteField = useDeleteTableField();
  const createRec   = useCreateRecord();
  const updateRec   = useUpdateRecord();
  const deleteRec   = useDeleteRecord();
  const bulkDelete  = useBulkDeleteRecords();
  const renameTable = useRenameTable();

  const handleAddField = async () => {
    if (!newFieldName.trim()) return;
    await addField.mutateAsync({ tableId: tableId!, name: newFieldName.trim(), type: newFieldType });
    setShowAddField(false); setNewFieldName(''); setNewFieldType('TEXT');
  };

  const handleAddRow = async () => {
    await createRec.mutateAsync({ tableId: tableId!, cells: {} });
  };

  const startEdit = (recordId: string, fieldId: string, current: unknown) => {
    setEditingCell({ recordId, fieldId });
    setCellDraft(current !== undefined && current !== null ? String(current) : '');
  };

  const commitEdit = async () => {
    if (!editingCell) return;
    await updateRec.mutateAsync({
      tableId: tableId!,
      recordId: editingCell.recordId,
      cells: { [editingCell.fieldId]: cellDraft },
    });
    setEditingCell(null);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const records = table?.records ?? [];
    if (selected.size === records.length) setSelected(new Set());
    else setSelected(new Set(records.map((r) => r.id)));
  };

  const handleBulkDelete = async () => {
    await bulkDelete.mutateAsync({ tableId: tableId!, recordIds: Array.from(selected) });
    setSelected(new Set());
  };

  const handleRenameTable = async () => {
    if (!tableNameDraft.trim()) return;
    await renameTable.mutateAsync({ id: tableId!, name: tableNameDraft.trim() });
    setRenamingTable(false);
  };

  const exportCsv = () => {
    if (!table) return;
    const fields = table.fields;
    const header = ['id', ...fields.map((f) => f.name)].join(',');
    const rows = (table.records ?? []).map((r) =>
      [r.id, ...fields.map((f) => JSON.stringify(r.cells[f.id] ?? ''))].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${table.name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin text-accent" />
    </div>
  );

  if (!table) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <p className="text-text-muted">Table not found</p>
      <button onClick={() => navigate('/automations/tables')} className="text-sm text-accent hover:underline">← Back to Tables</button>
    </div>
  );

  const records = table.records ?? [];
  const fields  = table.fields ?? [];
  const { total, pageSize } = table.pagination;
  const totalPages = Math.ceil(total / pageSize);

  const renderCell = (record: TableRecord, field: TableField) => {
    const isEditing = editingCell?.recordId === record.id && editingCell?.fieldId === field.id;
    const val = record.cells[field.id];

    if (isEditing) {
      if (field.type === 'CHECKBOX') {
        return (
          <input type="checkbox" checked={cellDraft === 'true'} onChange={(e) => setCellDraft(String(e.target.checked))}
            onBlur={commitEdit} autoFocus className="w-4 h-4 accent-accent" />
        );
      }
      return (
        <input
          autoFocus
          type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
          value={cellDraft}
          onChange={(e) => setCellDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null); }}
          className="w-full px-2 py-1 bg-bg border border-accent rounded text-sm text-text-main focus:outline-none"
        />
      );
    }

    const displayVal = val !== undefined && val !== null && val !== '' ? String(val) : '';
    return (
      <span
        className="block w-full px-2 py-1 text-sm text-text-main cursor-text truncate min-h-[28px]"
        onClick={() => startEdit(record.id, field.id, val)}
      >
        {field.type === 'CHECKBOX' ? (val ? '✓' : '') : displayVal}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-surface shrink-0 flex items-center gap-3">
        <button onClick={() => navigate('/automations/tables')} className="p-2 hover:bg-bg rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-text-muted" />
        </button>

        {renamingTable ? (
          <div className="flex items-center gap-2">
            <input autoFocus value={tableNameDraft} onChange={(e) => setTableNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameTable(); if (e.key === 'Escape') setRenamingTable(false); }}
              className="px-2 py-1 bg-bg border border-accent rounded text-sm font-semibold text-text-main focus:outline-none" />
            <button onClick={handleRenameTable}><Check className="w-4 h-4 text-green-400" /></button>
            <button onClick={() => setRenamingTable(false)}><X className="w-4 h-4 text-text-muted" /></button>
          </div>
        ) : (
          <button onClick={() => { setRenamingTable(true); setTableNameDraft(table.name); }}
            className="flex items-center gap-1.5 hover:bg-bg px-2 py-1 rounded-lg transition-colors group">
            <h1 className="font-semibold text-text-main">{table.name}</h1>
            <Edit2 className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100" />
          </button>
        )}

        <span className="text-xs text-text-muted ml-1">{total.toLocaleString()} rows</span>

        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <button onClick={handleBulkDelete} disabled={bulkDelete.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg hover:bg-red-500/20 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete {selected.size} row{selected.size !== 1 ? 's' : ''}
            </button>
          )}
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted border border-border rounded-lg hover:bg-surface transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={handleAddRow} disabled={createRec.isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white text-xs rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors">
            {createRec.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add Row
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-border bg-surface/50 flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input type="text" placeholder="Search records..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 pr-4 py-1.5 bg-bg border border-border rounded-lg text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-accent w-60" />
        </div>
        <span className="text-xs text-text-muted ml-auto">
          {total > 0 ? `${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()}` : '0 records'}
        </span>
      </div>

      {/* Table grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-surface border-b border-border">
            <tr>
              {/* Checkbox */}
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" checked={selected.size > 0 && selected.size === records.length}
                  onChange={toggleAll} className="w-3.5 h-3.5 accent-accent" />
              </th>
              {/* Fields */}
              {fields.map((field) => (
                <th key={field.id} className="text-left px-3 py-2.5 font-medium text-xs text-text-muted uppercase tracking-wider min-w-[150px] border-l border-border/50">
                  <div className="flex items-center justify-between group/th">
                    <span>{field.name}</span>
                    <span className="text-[9px] text-text-muted/50 ml-1">{field.type}</span>
                    {field.name !== 'Name' && (
                      <button onClick={() => deleteField.mutateAsync({ tableId: tableId!, fieldId: field.id })}
                        className="opacity-0 group-hover/th:opacity-100 p-0.5 text-text-muted hover:text-red-400 transition-all ml-1">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {/* Add field */}
              <th className="px-3 py-2.5 border-l border-border/50 w-10">
                {showAddField ? (
                  <div className="flex items-center gap-1 min-w-[200px]">
                    <input autoFocus value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddField(); if (e.key === 'Escape') setShowAddField(false); }}
                      placeholder="Field name"
                      className="flex-1 px-2 py-1 bg-bg border border-accent rounded text-xs text-text-main focus:outline-none" />
                    <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)}
                      className="px-1 py-1 bg-bg border border-border rounded text-xs text-text-main focus:outline-none">
                      {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button onClick={handleAddField}><Check className="w-3.5 h-3.5 text-green-400" /></button>
                    <button onClick={() => setShowAddField(false)}><X className="w-3 h-3 text-text-muted" /></button>
                  </div>
                ) : (
                  <button onClick={() => setShowAddField(true)} className="p-1 text-text-muted hover:text-accent transition-colors" title="Add field">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {records.length === 0 ? (
              <tr>
                <td colSpan={fields.length + 2} className="px-4 py-12 text-center text-text-muted text-sm">
                  No records yet. Click "Add Row" to create the first entry.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id} className={`hover:bg-surface/40 transition-colors group ${selected.has(record.id) ? 'bg-accent/5' : ''}`}>
                  <td className="px-3 py-1.5">
                    <input type="checkbox" checked={selected.has(record.id)} onChange={() => toggleSelect(record.id)}
                      className="w-3.5 h-3.5 accent-accent" />
                  </td>
                  {fields.map((field) => (
                    <td key={field.id} className="px-1 py-1 border-l border-border/30">
                      {renderCell(record, field)}
                    </td>
                  ))}
                  <td className="px-2 py-1 border-l border-border/30">
                    <button onClick={() => deleteRec.mutateAsync({ tableId: tableId!, recordId: record.id })}
                      className="p-1 text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-surface shrink-0">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-bg disabled:opacity-40">Previous</button>
          <span className="text-xs text-text-muted">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-bg disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
