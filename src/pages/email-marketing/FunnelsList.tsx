/**
 * Funnels list (Wave 1 item 1.2 / outline 02-18).
 * Lists the workspace's funnels with real totals (views, submissions,
 * conversion — "—" at 0 views, never a fabricated %). Create is name-only
 * in v1 (no funnel templates); steps are added in the builder (Slice 2).
 * Publish / unpublish / duplicate / delete are real mutations.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { funnelsApi, publicFunnelUrl, type Funnel } from '../../lib/api/funnels';
import { useToast } from '../../components/ui/Toast';
import { HeaderPortal } from '../../components/layout/HeaderPortal';
import { ConfirmDelete } from '../../components/ui/ConfirmDelete';
import { Plus, Eye, Copy, Trash2, ExternalLink, Loader2 } from 'lucide-react';

function conversionLabel(funnel: Funnel): string {
  if (funnel.totals.conversion === null) return '—';
  return `${funnel.totals.conversion}%`;
}

export default function FunnelsList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Funnel | null>(null);

  const { data: funnels = [], isLoading, error } = useQuery({
    queryKey: ['funnels'],
    queryFn: funnelsApi.list,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['funnels'] });

  const createMutation = useMutation({
    mutationFn: (input: { name: string }) => funnelsApi.create(input),
    onSuccess: (funnel) => {
      invalidate();
      setShowCreate(false);
      setNewName('');
      toast('success', 'Funnel created', `"${funnel.name}" is ready — add steps to it.`);
      navigate(`/email-marketing/funnels/${funnel.id}`);
    },
    onError: (e: unknown) =>
      toast('error', 'Could not create funnel', e instanceof Error ? e.message : 'Unknown error'),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => funnelsApi.publish(id),
    onSuccess: (funnel) => {
      invalidate();
      toast('success', 'Funnel published', `"${funnel.name}" is live at ${publicFunnelUrl(funnel.slug, 1)}.`);
    },
    onError: (e: unknown) =>
      toast('error', 'Could not publish', e instanceof Error ? e.message : 'Unknown error'),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => funnelsApi.unpublish(id),
    onSuccess: () => {
      invalidate();
      toast('success', 'Funnel unpublished', 'The public step URLs no longer serve the funnel.');
    },
    onError: (e: unknown) =>
      toast('error', 'Could not unpublish', e instanceof Error ? e.message : 'Unknown error'),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => funnelsApi.duplicate(id),
    onSuccess: (page) => {
      invalidate();
      toast('success', 'Funnel duplicated', `"${page.name}" is a draft.`);
    },
    onError: (e: unknown) =>
      toast('error', 'Could not duplicate', e instanceof Error ? e.message : 'Unknown error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => funnelsApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast('success', 'Funnel deleted', 'The funnel, its steps, and its step views are gone.');
    },
    onError: (e: unknown) =>
      toast('error', 'Could not delete', e instanceof Error ? e.message : 'Unknown error'),
  });

  return (
    <div className="flex flex-col h-full w-full text-sm font-sans bg-bg text-text-main">
      <HeaderPortal>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Funnels</h1>
          <span className="text-text-muted">{funnels.length} {funnels.length === 1 ? 'funnel' : 'funnels'}</span>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New funnel
        </button>
      </HeaderPortal>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading funnels…
          </div>
        ) : error ? (
          <div className="text-red-500">
            Could not load funnels: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        ) : funnels.length === 0 ? (
          <div className="border border-border rounded-lg bg-surface p-8 text-center">
            <p className="font-semibold mb-1">No funnels yet</p>
            <p className="text-text-muted mb-4">
              Chain landing pages into steps — opt-in, sales page, offer, thank-you — and watch contacts move through them.
            </p>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> Create your first funnel
            </button>
          </div>
        ) : (
          <table className="w-full border border-border rounded-lg bg-surface overflow-hidden">
            <thead>
              <tr className="text-left text-text-muted border-b border-border">
                <th className="px-4 py-2 font-medium">Funnel</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Steps</th>
                <th className="px-4 py-2 font-medium text-right">Views</th>
                <th className="px-4 py-2 font-medium text-right">Submissions</th>
                <th className="px-4 py-2 font-medium text-right">Conversion</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {funnels.map((funnel) => (
                <tr key={funnel.id} className="border-b border-border last:border-b-0 hover:bg-surface-hover">
                  <td className="px-4 py-2">
                    <button
                      className="font-medium hover:underline text-left"
                      onClick={() => navigate(`/email-marketing/funnels/${funnel.id}`)}
                    >
                      {funnel.name}
                    </button>
                    <div className="text-text-muted text-xs">/{funnel.slug}</div>
                  </td>
                  <td className="px-4 py-2">
                    {funnel.status === 'published' ? (
                      <span className="text-green-500">Published</span>
                    ) : (
                      <span className="text-text-muted">Draft</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{funnel.steps.length}</td>
                  <td className="px-4 py-2 text-right">{funnel.totals.views}</td>
                  <td className="px-4 py-2 text-right">{funnel.totals.submissions}</td>
                  <td className="px-4 py-2 text-right">{conversionLabel(funnel)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {funnel.status === 'published' ? (
                        <>
                          <a
                            className="p-1.5 rounded hover:bg-surface-hover"
                            href={publicFunnelUrl(funnel.slug, 1)}
                            target="_blank"
                            rel="noreferrer"
                            title="View live funnel"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            className="p-1.5 rounded hover:bg-surface-hover"
                            title="Unpublish"
                            onClick={() => unpublishMutation.mutate(funnel.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          className="px-2 py-1 rounded bg-primary text-white text-xs"
                          onClick={() => publishMutation.mutate(funnel.id)}
                        >
                          Publish
                        </button>
                      )}
                      <button
                        className="p-1.5 rounded hover:bg-surface-hover"
                        title="Duplicate"
                        onClick={() => duplicateMutation.mutate(funnel.id)}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-surface-hover text-red-500"
                        title="Delete"
                        onClick={() => setDeleteTarget(funnel)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-lg p-6 w-full max-w-md">
            <h2 className="text-base font-semibold mb-4">New funnel</h2>
            <label className="block text-sm mb-1">Funnel name</label>
            <input
              className="w-full bg-bg border border-border rounded px-3 py-2 mb-4"
              placeholder="e.g. Free Guide Funnel"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <p className="text-text-muted text-xs mb-4">
              A funnel needs at least 2 steps to publish. Add them in the builder, each one linking a landing page.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={!newName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ name: newName.trim() })}
              >
                {createMutation.isPending ? 'Creating…' : 'Create funnel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDelete
          isOpen
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          title="Delete funnel?"
          message={`"${deleteTarget.name}" and its steps and step views will be permanently deleted. A published funnel's public URLs will stop working.`}
        />
      )}
    </div>
  );
}
