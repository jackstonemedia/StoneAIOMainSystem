/**
 * Landing Pages list (Wave 1 item 1.1 / outline 02-17).
 * Lists the workspace's pages with real stats (views, submissions,
 * conversion — "—" at 0 views, never a fabricated %). Create flows from
 * a starter template; publish / unpublish / duplicate / delete are real
 * mutations. The editor itself is Slice 2 (LandingPageBuilder).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { landingPagesApi, publicPageUrl, type LandingPage } from '../../lib/api/landingPages';
import { useToast } from '../../components/ui/Toast';
import { HeaderPortal } from '../../components/layout/HeaderPortal';
import { ConfirmDelete } from '../../components/ui/ConfirmDelete';
import { Plus, Eye, Copy, Trash2, ExternalLink, Loader2 } from 'lucide-react';

function conversionLabel(page: LandingPage): string {
  if (page.stats.conversion === null) return '—';
  return `${page.stats.conversion}%`;
}

export default function LandingPagesList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTemplate, setNewTemplate] = useState('lead-capture');
  const [deleteTarget, setDeleteTarget] = useState<LandingPage | null>(null);

  const { data: pages = [], isLoading, error } = useQuery({
    queryKey: ['landing-pages'],
    queryFn: landingPagesApi.list,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ['landing-pages', 'templates'],
    queryFn: landingPagesApi.templates,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['landing-pages'] });

  const createMutation = useMutation({
    mutationFn: (input: { name: string; templateId: string }) => landingPagesApi.create(input),
    onSuccess: (page) => {
      invalidate();
      setShowCreate(false);
      setNewName('');
      toast('success', 'Page created', `"${page.name}" is ready to edit.`);
      navigate(`/email-marketing/landing-pages/${page.id}`);
    },
    onError: (e: unknown) =>
      toast('error', 'Could not create page', e instanceof Error ? e.message : 'Unknown error'),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => landingPagesApi.publish(id),
    onSuccess: (page) => {
      invalidate();
      toast('success', 'Page published', `"${page.name}" is live at ${publicPageUrl(page.slug)}.`);
    },
    onError: (e: unknown) =>
      toast('error', 'Could not publish', e instanceof Error ? e.message : 'Unknown error'),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => landingPagesApi.unpublish(id),
    onSuccess: () => {
      invalidate();
      toast('success', 'Page unpublished', 'The public URL no longer serves the page.');
    },
    onError: (e: unknown) =>
      toast('error', 'Could not unpublish', e instanceof Error ? e.message : 'Unknown error'),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => landingPagesApi.duplicate(id),
    onSuccess: (page) => {
      invalidate();
      toast('success', 'Page duplicated', `"${page.name}" is a draft.`);
    },
    onError: (e: unknown) =>
      toast('error', 'Could not duplicate', e instanceof Error ? e.message : 'Unknown error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => landingPagesApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast('success', 'Page deleted', 'The page, its views, and its form responses are gone.');
    },
    onError: (e: unknown) =>
      toast('error', 'Could not delete', e instanceof Error ? e.message : 'Unknown error'),
  });

  return (
    <div className="flex flex-col h-full w-full text-sm font-sans bg-bg text-text-main">
      <HeaderPortal>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Landing Pages</h1>
          <span className="text-text-muted">{pages.length} {pages.length === 1 ? 'page' : 'pages'}</span>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New page
        </button>
      </HeaderPortal>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading pages…
          </div>
        ) : error ? (
          <div className="text-red-500">
            Could not load landing pages: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        ) : pages.length === 0 ? (
          <div className="border border-border rounded-lg bg-surface p-8 text-center">
            <p className="font-semibold mb-1">No landing pages yet</p>
            <p className="text-text-muted mb-4">
              Build a page from a template, publish it, and collect leads at a public URL.
            </p>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> Create your first page
            </button>
          </div>
        ) : (
          <table className="w-full border border-border rounded-lg bg-surface overflow-hidden">
            <thead>
              <tr className="text-left text-text-muted border-b border-border">
                <th className="px-4 py-2 font-medium">Page</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Views</th>
                <th className="px-4 py-2 font-medium text-right">Submissions</th>
                <th className="px-4 py-2 font-medium text-right">Conversion</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b border-border last:border-b-0 hover:bg-surface-hover">
                  <td className="px-4 py-2">
                    <button
                      className="font-medium hover:underline text-left"
                      onClick={() => navigate(`/email-marketing/landing-pages/${page.id}`)}
                    >
                      {page.name}
                    </button>
                    <div className="text-text-muted text-xs">/{page.slug}</div>
                  </td>
                  <td className="px-4 py-2">
                    {page.status === 'published' ? (
                      <span className="text-green-500">Published</span>
                    ) : (
                      <span className="text-text-muted">Draft</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{page.stats.views}</td>
                  <td className="px-4 py-2 text-right">{page.stats.submissions}</td>
                  <td className="px-4 py-2 text-right">{conversionLabel(page)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {page.status === 'published' ? (
                        <>
                          <a
                            className="p-1.5 rounded hover:bg-surface-hover"
                            href={publicPageUrl(page.slug)}
                            target="_blank"
                            rel="noreferrer"
                            title="View live page"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            className="p-1.5 rounded hover:bg-surface-hover"
                            title="Unpublish"
                            onClick={() => unpublishMutation.mutate(page.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          className="px-2 py-1 rounded bg-primary text-white text-xs"
                          onClick={() => publishMutation.mutate(page.id)}
                        >
                          Publish
                        </button>
                      )}
                      <button
                        className="p-1.5 rounded hover:bg-surface-hover"
                        title="Duplicate"
                        onClick={() => duplicateMutation.mutate(page.id)}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-surface-hover text-red-500"
                        title="Delete"
                        onClick={() => setDeleteTarget(page)}
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
            <h2 className="text-base font-semibold mb-4">New landing page</h2>
            <label className="block text-sm mb-1">Page name</label>
            <input
              className="w-full bg-bg border border-border rounded px-3 py-2 mb-4"
              placeholder="e.g. Free Guide"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <label className="block text-sm mb-1">Start from a template</label>
            <select
              className="w-full bg-bg border border-border rounded px-3 py-2 mb-4"
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.description}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={!newName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ name: newName.trim(), templateId: newTemplate })}
              >
                {createMutation.isPending ? 'Creating…' : 'Create page'}
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
          title="Delete landing page?"
          message={`"${deleteTarget.name}" and its views and form responses will be permanently deleted. A published page's public URL will stop working.`}
        />
      )}
    </div>
  );
}
