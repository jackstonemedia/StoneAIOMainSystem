import { useState } from 'react';
import {
  Link2, Plus, Trash2, Search, Loader2, RefreshCw,
  CheckCircle2, AlertCircle, Clock, Copy,
} from 'lucide-react';
import { useAPConnections, useCreateAPConnection } from '../../hooks/useWorkflows';
import { useToast } from '../../components/ui/Toast';
import type { APConnection } from '../../types/automation';
import { apiClient } from '../../lib/apiClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const STATUS_CFG: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
  ACTIVE:  { label: 'Active',  cls: 'text-green-400 bg-green-500/10 border-green-500/25',   icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  EXPIRED: { label: 'Expired', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25', icon: <Clock        className="w-3.5 h-3.5" /> },
  ERROR:   { label: 'Error',   cls: 'text-red-400 bg-red-500/10 border-red-500/25',          icon: <AlertCircle  className="w-3.5 h-3.5" /> },
};

export default function AutomationsConnections() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPiece, setNewPiece] = useState('');
  const [newType, setNewType] = useState('SECRET_TEXT');
  const [newValue, setNewValue] = useState('');

  const { data: connections = [], isLoading, refetch, isRefetching } = useAPConnections();
  const createConn = useCreateAPConnection();

  const deleteConn = useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/workflows/connections/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ap-connections'] });
      toast('success', 'Connection deleted', '');
    },
    onError: (e: any) => toast('error', 'Delete failed', e.message),
  });

  const filtered = search
    ? connections.filter((c: any) =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.pieceName?.toLowerCase().includes(search.toLowerCase()),
      )
    : connections;

  const handleCreate = async () => {
    if (!newName.trim() || !newPiece.trim()) {
      toast('error', 'Required fields missing', 'Name and piece name are required.');
      return;
    }
    try {
      await createConn.mutateAsync({
        pieceName: newPiece.trim(),
        name: newName.trim(),
        type: newType,
        value: { token: newValue },
      });
      setShowCreate(false);
      setNewName(''); setNewPiece(''); setNewValue('');
      toast('success', 'Connection created', `${newName} is now connected.`);
    } catch (e: any) {
      toast('error', 'Failed to create connection', e.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-surface shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Link2 className="w-4 h-4 text-accent" />
              Connections
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              {isLoading ? 'Loading...' : `${connections.length} connection${connections.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => refetch()} disabled={isRefetching}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted border border-border rounded-lg hover:bg-surface transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors">
              <Plus className="w-4 h-4" /> Add Connection
            </button>
          </div>
        </div>

        <div className="mt-3 relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input type="text" placeholder="Search connections..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-bg border border-border rounded-lg text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-accent" />
        </div>
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="px-6 py-4 border-b border-border bg-surface/50">
          <div className="max-w-lg bg-surface border border-border rounded-xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-text-main text-sm">New Connection</h3>
              <button onClick={() => setShowCreate(false)} className="text-xs text-text-muted hover:text-text-main">Cancel</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Connection Name *</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Slack Connection"
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Piece Name *</label>
                <input value={newPiece} onChange={(e) => setNewPiece(e.target.value)} placeholder="@activepieces/piece-slack"
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main font-mono focus:outline-none focus:border-accent" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Auth Type</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-accent">
                  <option value="SECRET_TEXT">API Key / Secret</option>
                  <option value="OAUTH2">OAuth2</option>
                  <option value="BASIC_AUTH">Basic Auth</option>
                  <option value="CUSTOM_AUTH">Custom Auth</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Token / Secret</label>
                <input type="password" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Enter your token"
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main font-mono focus:outline-none focus:border-accent" />
              </div>
            </div>
            <button onClick={handleCreate} disabled={createConn.isPending}
              className="w-full py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {createConn.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Connection
            </button>
          </div>
        </div>
      )}

      {/* Connection list */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Link2 className="w-7 h-7 text-accent" />
            </div>
            <div className="text-center">
              <p className="text-text-main font-semibold">No connections yet</p>
              <p className="text-text-muted text-sm mt-1">Connect your apps to automate workflows</p>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90">
              <Plus className="w-4 h-4" /> Add Connection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((conn: any) => {
              const statusKey = (conn.status ?? 'ACTIVE').toUpperCase() as keyof typeof STATUS_CFG;
              const cfg = STATUS_CFG[statusKey] ?? STATUS_CFG.ACTIVE;
              return (
                <div key={conn.id} className="bg-surface border border-border rounded-xl p-4 hover:border-accent/40 transition-colors group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <Link2 className="w-4 h-4 text-accent" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-text-main text-sm truncate">{conn.name}</p>
                        <p className="text-xs text-text-muted truncate">
                          {(conn.pieceName ?? '').replace('@activepieces/piece-', '')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteConn.mutate(conn.id ?? conn.apConnectionId)}
                      className="p-1.5 text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-bg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.cls}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {statusKey === 'EXPIRED' && (
                        <button
                          className="text-[10px] bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors px-2 py-0.5 rounded font-medium"
                          onClick={() => {
                            setNewPiece(conn.pieceName);
                            setNewName(conn.name);
                            setShowCreate(true);
                          }}
                        >
                          Reconnect
                        </button>
                      )}
                    </div>
                    {conn.created && (
                      <span className="text-[10px] text-text-muted">
                        {new Date(conn.created).toLocaleDateString()}
                      </span>
                    )}
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
