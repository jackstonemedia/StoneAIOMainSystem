/**
 * Funnel builder (Wave 1 item 1.2, Slice 2).
 * Edit a funnel's steps: add / remove / reorder (drag or arrow buttons) /
 * edit each step's page, offer, tag, and campaign. Save is explicit —
 * nothing autosaves, and the Save button reports the real outcome.
 * Publish requires at least 2 steps whose pages are published
 * (server-enforced). A step whose page was deleted or is still a draft
 * shows an honest warning and blocks publishing until fixed.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { funnelsApi, publicFunnelUrl, type Funnel, type FunnelStepInput } from '../../lib/api/funnels';
import { landingPagesApi } from '../../lib/api/landingPages';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, GripVertical, Loader2, ExternalLink } from 'lucide-react';

interface LocalStep {
  /** React key — stable across reorders; NOT sent to the server. */
  key: string;
  /** Real step id once saved; undefined for a step added in this session. */
  id?: string;
  landingPageId: string;
  offerTitle: string;
  offerBody: string;
  tagOnSubmit: string;
  campaignId: string;
}

let tmpKey = 0;
function toLocalStep(step: FunnelStepInput & { id?: string }): LocalStep {
  return {
    key: step.id ?? `tmp-${++tmpKey}`,
    id: step.id,
    landingPageId: step.landingPageId ?? '',
    offerTitle: step.offerTitle ?? '',
    offerBody: step.offerBody ?? '',
    tagOnSubmit: step.tagOnSubmit ?? '',
    campaignId: step.campaignId ?? '',
  };
}

function toServerStep(step: LocalStep): FunnelStepInput {
  return {
    ...(step.id ? { id: step.id } : {}),
    landingPageId: step.landingPageId,
    offerTitle: step.offerTitle || null,
    offerBody: step.offerBody || null,
    tagOnSubmit: step.tagOnSubmit || null,
    campaignId: step.campaignId || null,
  };
}

interface CampaignRow {
  id: string;
  name: string;
  status: string;
}

export default function FunnelBuilder() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: funnel, isLoading, error } = useQuery({
    queryKey: ['funnels', id],
    queryFn: () => funnelsApi.get(id),
  });

  const { data: pages = [] } = useQuery({
    queryKey: ['landing-pages'],
    queryFn: landingPagesApi.list,
  });

  const { data: campaigns = [] } = useQuery<CampaignRow[]>({
    queryKey: ['email-marketing', 'campaigns'],
    queryFn: async () => {
      const res = await apiClient.get('/email-marketing/campaigns');
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.campaigns)) return data.campaigns;
      return [];
    },
  });

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [steps, setSteps] = useState<LocalStep[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [initializedFor, setInitializedFor] = useState('');
  const [dragKey, setDragKey] = useState<string | null>(null);

  useEffect(() => {
    if (funnel && initializedFor !== funnel.id) {
      setName(funnel.name);
      setSlug(funnel.slug);
      setSteps(funnel.steps.map((s) => toLocalStep(s)));
      setInitializedFor(funnel.id);
    }
  }, [funnel, initializedFor]);

  const dirty = useMemo(() => {
    if (!funnel) return false;
    const savedSteps = funnel.steps.map((s) => toServerStep(toLocalStep(s)));
    const currentSteps = steps.map(toServerStep);
    return (
      name !== funnel.name ||
      slug !== funnel.slug ||
      JSON.stringify(currentSteps) !== JSON.stringify(savedSteps)
    );
  }, [funnel, name, slug, steps]);

  const saveMutation = useMutation({
    mutationFn: () =>
      funnelsApi.update(id, {
        name: name.trim() || funnel?.name,
        slug: slug.trim() || funnel?.slug,
        steps: steps.map(toServerStep),
      }),
    onSuccess: (updated: Funnel) => {
      qc.invalidateQueries({ queryKey: ['funnels'] });
      // The server may uniquify the slug — sync local state to the saved row
      // so the dirty flag clears honestly.
      setName(updated.name);
      setSlug(updated.slug);
      setSteps(updated.steps.map((s) => toLocalStep(s)));
      toast('success', 'Funnel saved', `"${updated.name}" is up to date.`);
    },
    onError: (e: unknown) =>
      toast('error', 'Could not save', e instanceof Error ? e.message : 'Unknown error'),
  });

  const publishMutation = useMutation({
    mutationFn: () => funnelsApi.publish(id),
    onSuccess: (updated: Funnel) => {
      qc.invalidateQueries({ queryKey: ['funnels'] });
      toast('success', 'Funnel published', `Live at ${publicFunnelUrl(updated.slug, 1)}.`);
    },
    onError: (e: unknown) =>
      toast('error', 'Could not publish', e instanceof Error ? e.message : 'Unknown error'),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => funnelsApi.unpublish(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['funnels'] });
      toast('success', 'Funnel unpublished', 'The public step URLs no longer serve the funnel.');
    },
    onError: (e: unknown) =>
      toast('error', 'Could not unpublish', e instanceof Error ? e.message : 'Unknown error'),
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['funnels', id, 'submissions'],
    queryFn: () => funnelsApi.submissions(id),
  });

  const selected = steps.find((s) => s.key === selectedKey) ?? null;
  const selectedIndex = selected ? steps.findIndex((s) => s.key === selected.key) : -1;
  const publishedPages = pages.filter((p) => p.status === 'published');

  const updateStep = (key: string, patch: Partial<LocalStep>) => {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const addStep = () => {
    // Default to the first published page not already used by a step in this
    // funnel — a second step pointing at the same page as the first is
    // almost never what the user wants. Falls back to the first published
    // page when every page is already used.
    const used = new Set(steps.map((s) => s.landingPageId));
    const defaultPage =
      publishedPages.find((p) => !used.has(p.id)) ?? publishedPages[0];
    const step: LocalStep = {
      key: `tmp-${++tmpKey}`,
      landingPageId: defaultPage?.id ?? '',
      offerTitle: '',
      offerBody: '',
      tagOnSubmit: '',
      campaignId: '',
    };
    setSteps((prev) => [...prev, step]);
    setSelectedKey(step.key);
  };

  const moveStep = (key: string, dir: 'up' | 'down') => {
    setSteps((prev) => {
      const i = prev.findIndex((s) => s.key === key);
      const j = dir === 'up' ? i - 1 : i + 1;
      if (i === -1 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const dropOn = (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) return;
    setSteps((prev) => {
      const from = prev.findIndex((s) => s.key === dragKey);
      const to = prev.findIndex((s) => s.key === targetKey);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragKey(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading funnel…
      </div>
    );
  }
  if (error || !funnel) {
    return (
      <div className="p-6">
        <p className="text-red-500 mb-4">
          Could not load this funnel: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <button className="btn-secondary" onClick={() => navigate('/email-marketing/funnels')}>
          Back to funnels
        </button>
      </div>
    );
  }

  // Server-side step info (page name/status, stats) keyed by real step id.
  const serverStepById = new Map(funnel.steps.map((s) => [s.id, s]));

  return (
    <div className="flex flex-col h-full w-full text-sm font-sans bg-bg text-text-main">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button
          className="p-1.5 rounded hover:bg-surface-hover"
          title="Back to funnels"
          onClick={() => navigate('/email-marketing/funnels')}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <input
          className="bg-transparent font-semibold text-base flex-1 min-w-0 outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Funnel name"
        />
        {funnel.status === 'published' ? (
          <span className="text-green-500 shrink-0">Published</span>
        ) : (
          <span className="text-text-muted shrink-0">Draft</span>
        )}
        <span className="text-text-muted shrink-0 hidden md:inline">
          {funnel.totals.views} views · {funnel.totals.submissions} submissions ·{' '}
          {funnel.totals.conversion === null ? '—' : `${funnel.totals.conversion}%`} conversion
        </span>
        {dirty && <span className="text-amber-500 shrink-0">Unsaved changes</span>}
        <button
          className="btn-primary shrink-0"
          disabled={!dirty || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </button>
        {funnel.status === 'published' ? (
          <>
            <a
              className="btn-secondary shrink-0"
              href={publicFunnelUrl(funnel.slug, 1)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="w-4 h-4" /> View live
            </a>
            <button className="btn-secondary shrink-0" onClick={() => unpublishMutation.mutate()}>
              Unpublish
            </button>
          </>
        ) : (
          <button
            className="px-3 py-1.5 rounded bg-primary text-white shrink-0 disabled:opacity-50"
            disabled={publishMutation.isPending}
            onClick={() => publishMutation.mutate()}
          >
            Publish
          </button>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left: steps + editor + settings + submissions */}
        <div className="w-80 shrink-0 border-r border-border overflow-y-auto p-4 flex flex-col gap-5">
          <div>
            <h2 className="font-semibold mb-2">Steps</h2>
            {steps.length === 0 && (
              <p className="text-text-muted mb-2">
                No steps yet — a funnel needs at least 2 to publish. Add one below.
              </p>
            )}
            <div className="flex flex-col gap-1">
              {steps.map((step, i) => {
                const page = pages.find((p) => p.id === step.landingPageId);
                const serverStep = step.id ? serverStepById.get(step.id) : undefined;
                const broken = step.landingPageId !== '' && !page;
                const draftPage = page && page.status !== 'published';
                return (
                  <div
                    key={step.key}
                    draggable
                    onDragStart={() => setDragKey(step.key)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropOn(step.key)}
                    onClick={() => setSelectedKey(step.key)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer border ${
                      selectedKey === step.key
                        ? 'border-primary bg-surface'
                        : 'border-transparent hover:bg-surface-hover'
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-text-muted shrink-0" />
                    <span className="flex-1 truncate">
                      <span className="font-medium">Step {i + 1}</span>
                      {page ? ` — ${page.name}` : step.landingPageId ? ' — page missing' : ' — no page yet'}
                      {(broken || draftPage) && (
                        <span className="block text-amber-500 text-xs">
                          {broken
                            ? 'Linked page was deleted — pick a different page.'
                            : 'Page is still a draft — publish it before publishing this funnel.'}
                        </span>
                      )}
                      {serverStep && (
                        <span className="block text-text-muted text-xs">
                          {serverStep.stats.views} views · {serverStep.stats.submissions} submissions ·{' '}
                          {serverStep.stats.conversion === null ? '—' : `${serverStep.stats.conversion}%`}
                        </span>
                      )}
                    </span>
                    <button
                      className="p-0.5 rounded hover:bg-surface-hover disabled:opacity-30"
                      title="Move up"
                      disabled={i === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveStep(step.key, 'up');
                      }}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-0.5 rounded hover:bg-surface-hover disabled:opacity-30"
                      title="Move down"
                      disabled={i === steps.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveStep(step.key, 'down');
                      }}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-0.5 rounded hover:bg-surface-hover text-red-500"
                      title="Remove step"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSteps((prev) => prev.filter((s) => s.key !== step.key));
                        if (selectedKey === step.key) setSelectedKey(null);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button className="btn-secondary text-xs mt-3" onClick={addStep}>
              <Plus className="w-3.5 h-3.5" /> Add step
            </button>
            <p className="text-text-muted text-xs mt-2">Drag a step to reorder, or use the arrows.</p>
          </div>

          {selected && (
            <div>
              <h2 className="font-semibold mb-2">Edit step {selectedIndex + 1}</h2>
              <div className="flex flex-col gap-3">
                <label className="block">
                  <span className="text-xs text-text-muted">Landing page</span>
                  <select
                    className="w-full bg-bg border border-border rounded px-3 py-2 mt-1"
                    value={selected.landingPageId}
                    onChange={(e) => updateStep(selected.key, { landingPageId: e.target.value })}
                  >
                    <option value="">Pick a landing page…</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.status === 'published' ? '' : '(draft)'}
                      </option>
                    ))}
                  </select>
                  {pages.length === 0 && (
                    <span className="text-xs text-text-muted">
                      No landing pages yet — build one first under Landing Pages.
                    </span>
                  )}
                </label>
                <label className="block">
                  <span className="text-xs text-text-muted">Offer title</span>
                  <input
                    className="w-full bg-bg border border-border rounded px-3 py-2 mt-1"
                    value={selected.offerTitle}
                    onChange={(e) => updateStep(selected.key, { offerTitle: e.target.value })}
                    placeholder="e.g. Get the free guide"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-text-muted">Offer details</span>
                  <textarea
                    className="w-full bg-bg border border-border rounded px-3 py-2 mt-1"
                    rows={3}
                    value={selected.offerBody}
                    onChange={(e) => updateStep(selected.key, { offerBody: e.target.value })}
                    placeholder="Shown with this step, above the page."
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-text-muted">Tag applied on submit</span>
                  <input
                    className="w-full bg-bg border border-border rounded px-3 py-2 mt-1"
                    value={selected.tagOnSubmit}
                    onChange={(e) => updateStep(selected.key, { tagOnSubmit: e.target.value })}
                    placeholder="e.g. funnel:guide"
                  />
                  <span className="text-xs text-text-muted">
                    Added to the contact when they submit this step — a segment matching the tag picks them up.
                  </span>
                </label>
                <label className="block">
                  <span className="text-xs text-text-muted">Enroll in campaign</span>
                  <select
                    className="w-full bg-bg border border-border rounded px-3 py-2 mt-1"
                    value={selected.campaignId}
                    onChange={(e) => updateStep(selected.key, { campaignId: e.target.value })}
                  >
                    <option value="">None — no follow-up email</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.status})
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-text-muted">
                    The contact is added as a recipient — they get the campaign when it sends. This is not a drip sequence.
                  </span>
                </label>
              </div>
            </div>
          )}

          <div>
            <h2 className="font-semibold mb-2">Funnel settings</h2>
            <label className="block mb-3">
              <span className="text-xs text-text-muted">URL slug</span>
              <input
                className="w-full bg-bg border border-border rounded px-3 py-2 mt-1"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={funnel.status === 'published'}
                title={
                  funnel.status === 'published'
                    ? 'Unpublish the funnel to change its URL.'
                    : 'Lowercase letters, numbers, and hyphens.'
                }
              />
              <span className="text-xs text-text-muted">
                First step URL: {publicFunnelUrl(slug, 1)}
                {funnel.status === 'published' ? '' : ' (draft — not live yet)'}
              </span>
            </label>
          </div>

          <div>
            <h2 className="font-semibold mb-2">Submissions ({submissions.length})</h2>
            {submissions.length === 0 ? (
              <p className="text-text-muted">
                No submissions through this funnel yet — publish it and share the first step URL.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {submissions.map((r) => (
                  <div key={r.id} className="border border-border rounded px-3 py-2 bg-surface">
                    <div className="font-medium">
                      {r.contact ? `${r.contact.firstName} ${r.contact.lastName}`.trim() : 'Unknown'}
                    </div>
                    <div className="text-text-muted text-xs">{r.contact?.email ?? 'No email'}</div>
                    <div className="text-text-muted text-xs">
                      Step {r.stepId ? steps.findIndex((s) => s.id === r.stepId) + 1 || '?' : '?'} ·{' '}
                      {new Date(r.submittedAt).toLocaleString()}
                    </div>
                    {typeof r.answers.message === 'string' && r.answers.message && (
                      <div className="text-xs mt-1 whitespace-pre-wrap">{r.answers.message}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: step overview */}
        <div className="flex-1 overflow-y-auto p-6">
          {steps.length === 0 ? (
            <p className="text-center text-text-muted mt-12">
              Add a step to see it here. Each step links a landing page — the visitor moves from one to the next by submitting the form.
            </p>
          ) : (
            <div className="max-w-2xl mx-auto flex flex-col gap-3">
              {steps.map((step, i) => {
                const page = pages.find((p) => p.id === step.landingPageId);
                const serverStep = step.id ? serverStepById.get(step.id) : undefined;
                return (
                  <div key={step.key}>
                    <div
                      className={`border border-border rounded-lg bg-surface p-4 cursor-pointer ${
                        selectedKey === step.key ? 'border-primary' : ''
                      }`}
                      onClick={() => setSelectedKey(step.key)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Step {i + 1}</span>
                        <span className="text-text-muted">
                          {page ? page.name : step.landingPageId ? 'Linked page missing' : 'No page yet'}
                        </span>
                        <span className="ml-auto text-text-muted text-xs">
                          {serverStep
                            ? `${serverStep.stats.views} views · ${serverStep.stats.submissions} submissions`
                            : 'Not saved yet'}
                        </span>
                      </div>
                      {step.offerTitle && <div className="font-medium mt-2">{step.offerTitle}</div>}
                      {step.offerBody && <div className="text-text-muted mt-1 whitespace-pre-wrap">{step.offerBody}</div>}
                      <div className="text-xs text-text-muted mt-2">
                        {step.tagOnSubmit ? `Tag on submit: ${step.tagOnSubmit}` : 'No tag on submit'}
                        {' · '}
                        {step.campaignId
                          ? `Enrolls in: ${campaigns.find((c) => c.id === step.campaignId)?.name ?? 'campaign'}`
                          : 'No campaign enrollment'}
                      </div>
                    </div>
                    {i < steps.length - 1 && (
                      <div className="flex justify-center py-1 text-text-muted" aria-hidden>
                        ↓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
