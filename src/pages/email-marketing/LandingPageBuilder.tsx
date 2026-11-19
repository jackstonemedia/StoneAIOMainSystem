/**
 * Landing page builder (Wave 1 item 1.1, Slice 2).
 * Edit a page's sections: add / remove / reorder (drag or arrow buttons) /
 * edit each section's content. The preview on the right uses the same
 * SectionRenderer as the public page, so editing shows the real result.
 * Save is explicit — nothing autosaves, and the Save button reports the
 * real outcome. Publish requires at least one section (server-enforced).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { landingPagesApi, publicPageUrl, type LandingPage } from '../../lib/api/landingPages';
import {
  SECTION_TYPES,
  SECTION_LABELS,
  createSection,
  moveSection,
  removeSection,
  updateSectionConfig,
} from '../../lib/landingPageSections';
import SectionRenderer from '../../components/landing-pages/SectionRenderer';
import { useToast } from '../../components/ui/Toast';
import type { PageSection } from '../../types';
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, GripVertical, Loader2, ExternalLink } from 'lucide-react';

const FIELD_LABELS: Record<string, string> = {
  heading: 'Heading',
  subheading: 'Subheading',
  buttonText: 'Button text',
  body: 'Body text',
  src: 'Image URL',
  alt: 'Alt text',
  caption: 'Caption',
};

function fieldKeys(type: PageSection['type']): string[] {
  switch (type) {
    case 'hero':
      return ['heading', 'subheading', 'buttonText'];
    case 'text':
      return ['heading', 'body'];
    case 'image':
      return ['src', 'alt', 'caption'];
    case 'form':
      return ['heading', 'buttonText'];
    case 'cta':
      return ['heading', 'buttonText'];
  }
}

export default function LandingPageBuilder() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: page, isLoading, error } = useQuery({
    queryKey: ['landing-pages', id],
    queryFn: () => landingPagesApi.get(id),
  });

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');
  const [sections, setSections] = useState<PageSection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initializedFor, setInitializedFor] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    if (page && initializedFor !== page.id) {
      setName(page.name);
      setSlug(page.slug);
      setSeoTitle(page.seoTitle ?? '');
      setSeoDesc(page.seoDesc ?? '');
      setSections(Array.isArray(page.sectionsJson) ? (page.sectionsJson as PageSection[]) : []);
      setInitializedFor(page.id);
    }
  }, [page, initializedFor]);

  const dirty = useMemo(() => {
    if (!page) return false;
    const savedSections = Array.isArray(page.sectionsJson) ? page.sectionsJson : [];
    return (
      name !== page.name ||
      slug !== page.slug ||
      seoTitle !== (page.seoTitle ?? '') ||
      seoDesc !== (page.seoDesc ?? '') ||
      JSON.stringify(sections) !== JSON.stringify(savedSections)
    );
  }, [page, name, slug, seoTitle, seoDesc, sections]);

  const saveMutation = useMutation({
    mutationFn: () =>
      landingPagesApi.update(id, {
        name: name.trim() || page?.name,
        slug: slug.trim() || page?.slug,
        seoTitle: seoTitle.trim() || null,
        seoDesc: seoDesc.trim() || null,
        sectionsJson: sections,
      }),
    onSuccess: (updated: LandingPage) => {
      qc.invalidateQueries({ queryKey: ['landing-pages'] });
      // The server may uniquify the slug — sync local state to the saved row
      // so the dirty flag clears honestly.
      setName(updated.name);
      setSlug(updated.slug);
      setSeoTitle(updated.seoTitle ?? '');
      setSeoDesc(updated.seoDesc ?? '');
      setSections(Array.isArray(updated.sectionsJson) ? (updated.sectionsJson as PageSection[]) : []);
      toast('success', 'Page saved', `"${updated.name}" is up to date.`);
    },
    onError: (e: unknown) =>
      toast('error', 'Could not save', e instanceof Error ? e.message : 'Unknown error'),
  });

  const publishMutation = useMutation({
    mutationFn: () => landingPagesApi.publish(id),
    onSuccess: (updated: LandingPage) => {
      qc.invalidateQueries({ queryKey: ['landing-pages'] });
      toast('success', 'Page published', `Live at ${publicPageUrl(updated.slug)}.`);
    },
    onError: (e: unknown) =>
      toast('error', 'Could not publish', e instanceof Error ? e.message : 'Unknown error'),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => landingPagesApi.unpublish(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landing-pages'] });
      toast('success', 'Page unpublished', 'The public URL no longer serves the page.');
    },
    onError: (e: unknown) =>
      toast('error', 'Could not unpublish', e instanceof Error ? e.message : 'Unknown error'),
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['landing-pages', id, 'responses'],
    queryFn: () => landingPagesApi.responses(id),
  });

  const selected = sections.find((s) => s.id === selectedId) ?? null;

  const addSection = (type: PageSection['type']) => {
    const section = createSection(type);
    setSections((prev) => [...prev, section]);
    setSelectedId(section.id);
  };

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setSections((prev) => {
      const from = prev.findIndex((s) => s.id === dragId);
      const to = prev.findIndex((s) => s.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading page…
      </div>
    );
  }
  if (error || !page) {
    return (
      <div className="p-6">
        <p className="text-red-500 mb-4">
          Could not load this page: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <button className="btn-secondary" onClick={() => navigate('/email-marketing/landing-pages')}>
          Back to landing pages
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full text-sm font-sans bg-bg text-text-main">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button
          className="p-1.5 rounded hover:bg-surface-hover"
          title="Back to landing pages"
          onClick={() => navigate('/email-marketing/landing-pages')}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <input
          className="bg-transparent font-semibold text-base flex-1 min-w-0 outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Page name"
        />
        {page.status === 'published' ? (
          <span className="text-green-500 shrink-0">Published</span>
        ) : (
          <span className="text-text-muted shrink-0">Draft</span>
        )}
        <span className="text-text-muted shrink-0 hidden md:inline">
          {page.stats.views} views · {page.stats.submissions} submissions ·{' '}
          {page.stats.conversion === null ? '—' : `${page.stats.conversion}%`} conversion
        </span>
        {dirty && <span className="text-amber-500 shrink-0">Unsaved changes</span>}
        <button
          className="btn-primary shrink-0"
          disabled={!dirty || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </button>
        {page.status === 'published' ? (
          <>
            <a
              className="btn-secondary shrink-0"
              href={publicPageUrl(page.slug)}
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
        {/* Left: sections + editor + page settings */}
        <div className="w-80 shrink-0 border-r border-border overflow-y-auto p-4 flex flex-col gap-5">
          <div>
            <h2 className="font-semibold mb-2">Sections</h2>
            {sections.length === 0 && (
              <p className="text-text-muted mb-2">No sections yet — add one below.</p>
            )}
            <div className="flex flex-col gap-1">
              {sections.map((section, i) => (
                <div
                  key={section.id}
                  draggable
                  onDragStart={() => setDragId(section.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOn(section.id)}
                  onClick={() => setSelectedId(section.id)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer border ${
                    selectedId === section.id
                      ? 'border-primary bg-surface'
                      : 'border-transparent hover:bg-surface-hover'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-text-muted shrink-0" />
                  <span className="flex-1 truncate">
                    {SECTION_LABELS[section.type]}
                    {typeof section.config.heading === 'string' && section.config.heading
                      ? ` — ${section.config.heading}`
                      : ''}
                  </span>
                  <button
                    className="p-0.5 rounded hover:bg-surface-hover disabled:opacity-30"
                    title="Move up"
                    disabled={i === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSections((prev) => moveSection(prev, section.id, 'up'));
                    }}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-0.5 rounded hover:bg-surface-hover disabled:opacity-30"
                    title="Move down"
                    disabled={i === sections.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSections((prev) => moveSection(prev, section.id, 'down'));
                    }}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-0.5 rounded hover:bg-surface-hover text-red-500"
                    title="Remove section"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSections((prev) => removeSection(prev, section.id));
                      if (selectedId === section.id) setSelectedId(null);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 mt-3">
              {SECTION_TYPES.map((type) => (
                <button key={type} className="btn-secondary text-xs" onClick={() => addSection(type)}>
                  <Plus className="w-3.5 h-3.5" /> {SECTION_LABELS[type]}
                </button>
              ))}
            </div>
            <p className="text-text-muted text-xs mt-2">Drag a section to reorder, or use the arrows.</p>
          </div>

          {selected && (
            <div>
              <h2 className="font-semibold mb-2">Edit {SECTION_LABELS[selected.type]}</h2>
              <div className="flex flex-col gap-3">
                {fieldKeys(selected.type).map((key) => (
                  <label key={key} className="block">
                    <span className="text-xs text-text-muted">{FIELD_LABELS[key]}</span>
                    {key === 'body' ? (
                      <textarea
                        className="w-full bg-bg border border-border rounded px-3 py-2 mt-1"
                        rows={4}
                        value={typeof selected.config[key] === 'string' ? (selected.config[key] as string) : ''}
                        onChange={(e) =>
                          setSections((prev) => updateSectionConfig(prev, selected.id, { [key]: e.target.value }))
                        }
                      />
                    ) : (
                      <input
                        className="w-full bg-bg border border-border rounded px-3 py-2 mt-1"
                        value={typeof selected.config[key] === 'string' ? (selected.config[key] as string) : ''}
                        onChange={(e) =>
                          setSections((prev) => updateSectionConfig(prev, selected.id, { [key]: e.target.value }))
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="font-semibold mb-2">Page settings</h2>
            <label className="block mb-3">
              <span className="text-xs text-text-muted">URL slug</span>
              <input
                className="w-full bg-bg border border-border rounded px-3 py-2 mt-1"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={page.status === 'published'}
                title={
                  page.status === 'published'
                    ? 'Unpublish the page to change its URL.'
                    : 'Lowercase letters, numbers, and hyphens.'
                }
              />
              <span className="text-xs text-text-muted">
                Public URL: {publicPageUrl(slug)}
                {page.status === 'published' ? '' : ' (draft — not live yet)'}
              </span>
            </label>
            <label className="block mb-3">
              <span className="text-xs text-text-muted">SEO title</span>
              <input
                className="w-full bg-bg border border-border rounded px-3 py-2 mt-1"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Shown in search results and the browser tab"
              />
            </label>
            <label className="block">
              <span className="text-xs text-text-muted">SEO description</span>
              <textarea
                className="w-full bg-bg border border-border rounded px-3 py-2 mt-1"
                rows={2}
                value={seoDesc}
                onChange={(e) => setSeoDesc(e.target.value)}
                placeholder="Shown in search results"
              />
            </label>
          </div>

          <div>
            <h2 className="font-semibold mb-2">
              Submissions ({responses.length})
            </h2>
            {responses.length === 0 ? (
              <p className="text-text-muted">
                No submissions yet — share the public URL to collect leads.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {responses.map((r) => (
                  <div key={r.id} className="border border-border rounded px-3 py-2 bg-surface">
                    <div className="font-medium">
                      {r.contact ? `${r.contact.firstName} ${r.contact.lastName}`.trim() : 'Unknown'}
                    </div>
                    <div className="text-text-muted text-xs">{r.contact?.email ?? 'No email'}</div>
                    <div className="text-text-muted text-xs">
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

        {/* Right: preview */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto my-6 border border-border rounded-lg overflow-hidden">
            <SectionRenderer sections={sections} preview />
          </div>
          {sections.length === 0 && (
            <p className="text-center text-text-muted">Add a section to see the preview.</p>
          )}
        </div>
      </div>
    </div>
  );
}
