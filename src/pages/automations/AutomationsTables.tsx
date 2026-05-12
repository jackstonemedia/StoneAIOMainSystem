import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table2, Plus, Trash2, Loader2, Search, Edit2, Check, X,
  ChevronRight, Database,
} from 'lucide-react';
import { useTables, useCreateTable, useDeleteTable, useRenameTable } from '../../hooks/useTables';

export default function AutomationsTables() {
  const navigate = useNavigate();
  const [createName, setCreateName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: tables = [], isLoading } = useTables();
  const createTable = useCreateTable();
  const deleteTable = useDeleteTable();
  const renameTable = useRenameTable();

  const filtered = search
    ? tables.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : tables;

  const handleCreate = async () => {
    if (!createName.trim()) return;
    const tbl = await createTable.mutateAsync({ name: createName.trim() });
    setCreateName(''); setShowCreate(false);
    navigate(`/automations/tables/${tbl.id}`);
  };

  const handleRename = async (id: string) => {
    if (!renameVal.trim()) return;
    await renameTable.mutateAsync({ id, name: renameVal.trim() });
    setRenamingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-surface shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Table2 className="w-4 h-4 text-accent" />
              Tables
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              {isLoading ? 'Loading...' : `${tables.length} table${tables.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Table
          </button>
        </div>
        <div className="mt-3 relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input type="text" placeholder="Search tables..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-bg border border-border rounded-lg text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="px-6 py-4 border-b border-border bg-surface/50">
          <div className="max-w-sm flex items-center gap-3">
            <input
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
              placeholder="Table name"
              className="flex-1 px-3 py-2 bg-bg border border-accent rounded-lg text-sm text-text-main focus:outline-none"
            />
            <button onClick={handleCreate} disabled={createTable.isPending || !createName.trim()}
              className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1.5">
              {createTable.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="p-2 text-text-muted hover:text-text-main">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tables grid */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-text-muted" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Database className="w-7 h-7 text-accent" />
            </div>
            <div className="text-center">
              <p className="text-text-main font-semibold">No tables yet</p>
              <p className="text-text-muted text-sm mt-1">Tables let you store and manage structured data for your automations</p>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90">
              <Plus className="w-4 h-4" /> Create Table
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((table) => {
              if (deleteConfirm === table.id) {
                return (
                  <div key={table.id} className="bg-surface border border-red-500/30 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-medium text-text-main">Delete "{table.name}"?</p>
                    <p className="text-xs text-text-muted">All {table.rowCount} records will be permanently deleted.</p>
                    <div className="flex gap-2">
                      <button onClick={() => { deleteTable.mutate(table.id); setDeleteConfirm(null); }}
                        className="flex-1 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">Delete</button>
                      <button onClick={() => setDeleteConfirm(null)}
                        className="flex-1 py-1.5 border border-border text-xs text-text-muted rounded-lg hover:bg-bg">Cancel</button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={table.id}
                  className="bg-surface border border-border rounded-xl p-4 hover:border-accent/40 transition-colors group cursor-pointer"
                  onClick={() => navigate(`/automations/tables/${table.id}`)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Table2 className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { setRenamingId(table.id); setRenameVal(table.name); }}
                        className="p-1.5 text-text-muted hover:text-accent rounded-lg hover:bg-bg">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteConfirm(table.id)}
                        className="p-1.5 text-text-muted hover:text-red-400 rounded-lg hover:bg-bg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {renamingId === table.id ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRename(table.id); if (e.key === 'Escape') setRenamingId(null); }}
                        className="flex-1 px-2 py-1 bg-bg border border-accent rounded text-sm text-text-main focus:outline-none" />
                      <button onClick={() => handleRename(table.id)}><Check className="w-3.5 h-3.5 text-green-400" /></button>
                    </div>
                  ) : (
                    <h3 className="font-semibold text-text-main text-sm mb-1 truncate">{table.name}</h3>
                  )}

                  <div className="flex items-center justify-between text-xs text-text-muted mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2">
                      <span>{table.rowCount.toLocaleString()} rows</span>
                      <span>·</span>
                      <span>{table.fields.length} fields</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-accent transition-opacity" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
