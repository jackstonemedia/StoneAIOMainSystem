/**
 * Funnel service (Wave 1 item 1.2 / outline 02-18).
 * Authed CRUD + publish + per-step stats. The public render/progression side
 * lives in api/services/funnels/public-funnel.service.ts (Slice 3).
 *
 * A funnel is an ordered chain of steps. Each step links a landing page
 * (the page, its form, and its analytics already exist) plus an offer, a tag
 * applied to the contact on submit, and an optional campaign to enroll the
 * contact into. There is no drip-sequence entity in v1 — the campaign
 * enrollment is the runnable follow-up (see the funnels Blueprint).
 */
import { db } from '../../../infrastructure/database/client.js';
import { AppError } from '../../middleware/error.js';

export const FUNNEL_STATUSES = ['draft', 'published'] as const;
export type FunnelStatus = (typeof FUNNEL_STATUSES)[number];

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;
const TAG_RE = /^[^,"\n]{1,100}$/;

export interface FunnelStepStats {
  views: number;
  submissions: number;
  /** Null when there are no views — never a fabricated 0%. */
  conversion: number | null;
  /** Share of this step's viewers who reached the next step; null on the last step or at 0 views. */
  reachedNext: number | null;
}

export interface FunnelStepWithStats {
  id: string;
  position: number;
  landingPageId: string;
  offerTitle: string | null;
  offerBody: string | null;
  tagOnSubmit: string | null;
  campaignId: string | null;
  /** Null when the linked page was deleted — the builder shows a broken-step warning. */
  landingPage: { id: string; name: string; slug: string; status: string } | null;
  campaign: { id: string; name: string; status: string } | null;
  stats: FunnelStepStats;
}

export interface FunnelWithStats {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  steps: FunnelStepWithStats[];
  totals: { views: number; submissions: number; conversion: number | null };
}

export interface FunnelStepInput {
  id?: unknown;
  landingPageId?: unknown;
  offerTitle?: unknown;
  offerBody?: unknown;
  tagOnSubmit?: unknown;
  campaignId?: unknown;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64) || 'funnel';
}

export function validateSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new AppError(
      400,
      'Slug must be 3-64 characters: lowercase letters, numbers, and hyphens, starting with a letter or number.',
    );
  }
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  let n = 2;
  for (;;) {
    const existing = await db.funnel.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${n++}`;
  }
}

function toConversion(views: number, submissions: number): number | null {
  return views > 0 ? Math.round((submissions / views) * 1000) / 10 : null;
}

function optString(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new AppError(400, `${field} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new AppError(400, `${field} must be ${max} characters or fewer.`);
  return trimmed || null;
}

/** Validates one step input and returns the normalized shape (no id handling here). */
function validateStepInput(raw: unknown, index: number): {
  id: string | null;
  landingPageId: string;
  offerTitle: string | null;
  offerBody: string | null;
  tagOnSubmit: string | null;
  campaignId: string | null;
} {
  if (typeof raw !== 'object' || raw === null) {
    throw new AppError(400, `Step ${index + 1} must be an object.`);
  }
  const step = raw as Record<string, unknown>;
  const landingPageId = typeof step.landingPageId === 'string' ? step.landingPageId.trim() : '';
  if (!landingPageId) throw new AppError(400, `Step ${index + 1} needs a landing page.`);
  const tag = optString(step.tagOnSubmit, `Step ${index + 1} tag`, 100);
  if (tag !== null && !TAG_RE.test(tag)) {
    throw new AppError(400, `Step ${index + 1} tag must be 1-100 characters with no commas or quotes.`);
  }
  return {
    id: typeof step.id === 'string' && step.id ? step.id : null,
    landingPageId,
    offerTitle: optString(step.offerTitle, `Step ${index + 1} offer title`, 200),
    offerBody: optString(step.offerBody, `Step ${index + 1} offer`, 2000),
    tagOnSubmit: tag,
    campaignId: optString(step.campaignId, `Step ${index + 1} campaign`, 100),
  };
}

async function validateStepReferences(
  workspaceId: string,
  steps: { landingPageId: string; campaignId: string | null }[],
): Promise<Map<string, { id: string; status: string }>> {
  const pageIds = [...new Set(steps.map((s) => s.landingPageId))];
  const pages = await db.landingPage.findMany({
    where: { id: { in: pageIds }, workspaceId },
    select: { id: true, status: true },
  });
  const pageMap = new Map(pages.map((p) => [p.id, p]));
  for (const s of steps) {
    if (!pageMap.has(s.landingPageId)) {
      throw new AppError(400, `Landing page not found: ${s.landingPageId}.`);
    }
  }
  const campaignIds = [...new Set(steps.map((s) => s.campaignId).filter((c): c is string => !!c))];
  if (campaignIds.length > 0) {
    const campaigns = await db.campaign.findMany({
      where: { id: { in: campaignIds }, workspaceId },
      select: { id: true },
    });
    const found = new Set(campaigns.map((c) => c.id));
    for (const id of campaignIds) {
      if (!found.has(id)) throw new AppError(400, `Campaign not found: ${id}.`);
    }
  }
  return pageMap;
}

async function countStepViews(stepIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (stepIds.length === 0) return counts;
  const rows = await db.funnelStepView.groupBy({
    by: ['stepId'],
    where: { stepId: { in: stepIds } },
    _count: { _all: true },
  });
  for (const r of rows) counts.set(r.stepId, r._count._all);
  return counts;
}

async function countStepSubmissions(stepIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (stepIds.length === 0) return counts;
  const rows = await db.formResponse.groupBy({
    by: ['funnelStepId'],
    where: { funnelStepId: { in: stepIds } },
    _count: { _all: true },
  });
  for (const r of rows) {
    if (r.funnelStepId) counts.set(r.funnelStepId, r._count._all);
  }
  return counts;
}

type StepRow = {
  id: string;
  position: number;
  landingPageId: string;
  offerTitle: string | null;
  offerBody: string | null;
  tagOnSubmit: string | null;
  campaignId: string | null;
  landingPage: { id: string; name: string; slug: string; status: string } | null;
  campaign: { id: string; name: string; status: string } | null;
};

const stepInclude = {
  landingPage: { select: { id: true, name: true, slug: true, status: true } },
  campaign: { select: { id: true, name: true, status: true } },
} as const;

async function toFunnelWithStats(
  funnel: {
    id: string;
    workspaceId: string;
    name: string;
    slug: string;
    status: string;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  steps: StepRow[],
): Promise<FunnelWithStats> {
  const stepIds = steps.map((s) => s.id);
  const views = await countStepViews(stepIds);
  const submissions = await countStepSubmissions(stepIds);
  const ordered = [...steps].sort((a, b) => a.position - b.position);
  const withStats: FunnelStepWithStats[] = ordered.map((s, i) => {
    const v = views.get(s.id) ?? 0;
    const sub = submissions.get(s.id) ?? 0;
    const nextViews = i + 1 < ordered.length ? views.get(ordered[i + 1].id) ?? 0 : null;
    return {
      id: s.id,
      position: s.position,
      landingPageId: s.landingPageId,
      offerTitle: s.offerTitle,
      offerBody: s.offerBody,
      tagOnSubmit: s.tagOnSubmit,
      campaignId: s.campaignId,
      landingPage: s.landingPage,
      campaign: s.campaign,
      stats: {
        views: v,
        submissions: sub,
        conversion: toConversion(v, sub),
        reachedNext:
          nextViews === null || v === 0 ? null : Math.round((nextViews / v) * 1000) / 10,
      },
    };
  });
  const totalViews = withStats.reduce((n, s) => n + s.stats.views, 0);
  const totalSubmissions = withStats.reduce((n, s) => n + s.stats.submissions, 0);
  return {
    ...funnel,
    steps: withStats,
    totals: {
      views: totalViews,
      submissions: totalSubmissions,
      conversion: toConversion(totalViews, totalSubmissions),
    },
  };
}

async function loadFunnelSteps(funnelId: string): Promise<StepRow[]> {
  return db.funnelStep.findMany({
    where: { funnelId },
    orderBy: { position: 'asc' },
    include: stepInclude,
  });
}

async function loadFunnelOr404(workspaceId: string, id: string) {
  const funnel = await db.funnel.findFirst({ where: { id, workspaceId } });
  if (!funnel) throw new AppError(404, 'Funnel not found.');
  return funnel;
}

/** Syncs a funnel's steps to the given list, preserving step ids (and their view history) where given. */
async function syncSteps(
  workspaceId: string,
  funnelId: string,
  rawSteps: unknown,
): Promise<void> {
  if (!Array.isArray(rawSteps)) throw new AppError(400, 'Steps must be an array.');
  const steps = rawSteps.map((s, i) => validateStepInput(s, i));
  await validateStepReferences(workspaceId, steps);

  const existing = await db.funnelStep.findMany({ where: { funnelId }, select: { id: true } });
  const existingIds = new Set(existing.map((s) => s.id));
  const incomingIds = new Set(steps.map((s) => s.id).filter((id): id is string => !!id));
  for (const s of steps) {
    if (s.id && !existingIds.has(s.id)) {
      throw new AppError(400, `Step not found: ${s.id}.`);
    }
  }
  const toDelete = existing.filter((s) => !incomingIds.has(s.id)).map((s) => s.id);

  await db.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.funnelStepView.deleteMany({ where: { stepId: { in: toDelete } } });
      await tx.funnelStep.deleteMany({ where: { id: { in: toDelete } } });
    }
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const data = {
        position: i,
        landingPageId: s.landingPageId,
        offerTitle: s.offerTitle,
        offerBody: s.offerBody,
        tagOnSubmit: s.tagOnSubmit,
        campaignId: s.campaignId,
      };
      if (s.id) {
        await tx.funnelStep.update({ where: { id: s.id }, data });
      } else {
        await tx.funnelStep.create({
          data: { workspaceId, funnelId, ...data },
        });
      }
    }
  });
}

export async function listFunnels(workspaceId: string): Promise<FunnelWithStats[]> {
  const funnels = await db.funnel.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
  });
  const out: FunnelWithStats[] = [];
  for (const f of funnels) {
    out.push(await toFunnelWithStats(f, await loadFunnelSteps(f.id)));
  }
  return out;
}

export async function getFunnel(workspaceId: string, id: string): Promise<FunnelWithStats> {
  const funnel = await loadFunnelOr404(workspaceId, id);
  return toFunnelWithStats(funnel, await loadFunnelSteps(funnel.id));
}

export async function createFunnel(
  workspaceId: string,
  input: { name?: unknown; slug?: unknown; steps?: unknown },
): Promise<FunnelWithStats> {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) throw new AppError(400, 'Name is required.');
  const slugBase =
    typeof input.slug === 'string' && input.slug.trim()
      ? input.slug.trim().toLowerCase()
      : slugify(name);
  validateSlug(slugBase);
  const slug = await uniqueSlug(slugBase);

  const funnel = await db.funnel.create({
    data: { workspaceId, name, slug, status: 'draft' },
  });
  if (input.steps !== undefined) {
    await syncSteps(workspaceId, funnel.id, input.steps);
  }
  return toFunnelWithStats(funnel, await loadFunnelSteps(funnel.id));
}

export async function updateFunnel(
  workspaceId: string,
  id: string,
  input: { name?: unknown; slug?: unknown; steps?: unknown },
): Promise<FunnelWithStats> {
  const funnel = await loadFunnelOr404(workspaceId, id);
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) throw new AppError(400, 'Name is required.');
    data.name = name;
  }
  if (input.slug !== undefined) {
    // A published funnel keeps its slug — changing it would break the live step URLs.
    if (funnel.status === 'published') {
      throw new AppError(400, 'Unpublish the funnel before changing its URL slug.');
    }
    const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
    validateSlug(slug);
    data.slug = await uniqueSlug(slug, id);
  }
  const updated = await db.funnel.update({ where: { id }, data });
  if (input.steps !== undefined) {
    await syncSteps(workspaceId, id, input.steps);
  }
  return toFunnelWithStats(updated, await loadFunnelSteps(id));
}

export async function deleteFunnel(workspaceId: string, id: string): Promise<void> {
  const funnel = await loadFunnelOr404(workspaceId, id);
  // Explicit child deletes: the dev scaffold DB carries no FK cascades, so
  // Prisma's onDelete: Cascade cannot be relied on here. Form responses keep
  // their funnel attribution — they are contact history, not funnel rows.
  await db.$transaction([
    db.funnelStepView.deleteMany({ where: { funnelId: funnel.id } }),
    db.funnelStep.deleteMany({ where: { funnelId: funnel.id } }),
    db.funnel.delete({ where: { id: funnel.id } }),
  ]);
}

export async function publishFunnel(workspaceId: string, id: string): Promise<FunnelWithStats> {
  const funnel = await loadFunnelOr404(workspaceId, id);
  const steps = await loadFunnelSteps(funnel.id);
  if (steps.length < 2) {
    throw new AppError(400, 'A funnel needs at least 2 steps before publishing.');
  }
  for (const [i, s] of steps.entries()) {
    if (!s.landingPage) {
      throw new AppError(400, `Step ${i + 1} links a landing page that was deleted. Pick a different page.`);
    }
    if (s.landingPage.status !== 'published') {
      throw new AppError(
        400,
        `Step ${i + 1} links "${s.landingPage.name}", which is not published. Publish the page first.`,
      );
    }
  }
  const published = await db.funnel.update({
    where: { id },
    data: { status: 'published', publishedAt: new Date() },
  });
  return toFunnelWithStats(published, steps);
}

export async function unpublishFunnel(workspaceId: string, id: string): Promise<FunnelWithStats> {
  const funnel = await loadFunnelOr404(workspaceId, id);
  const updated = await db.funnel.update({
    where: { id },
    data: { status: 'draft', publishedAt: null },
  });
  return toFunnelWithStats(updated, await loadFunnelSteps(id));
}

export async function duplicateFunnel(workspaceId: string, id: string): Promise<FunnelWithStats> {
  const funnel = await loadFunnelOr404(workspaceId, id);
  const steps = await loadFunnelSteps(funnel.id);
  const slug = await uniqueSlug(`${funnel.slug}-copy`);
  const copy = await db.funnel.create({
    data: { workspaceId, name: `${funnel.name} (copy)`, slug, status: 'draft' },
  });
  if (steps.length > 0) {
    await db.funnelStep.createMany({
      data: steps.map((s, i) => ({
        workspaceId,
        funnelId: copy.id,
        position: i,
        landingPageId: s.landingPageId,
        offerTitle: s.offerTitle,
        offerBody: s.offerBody,
        tagOnSubmit: s.tagOnSubmit,
        campaignId: s.campaignId,
      })),
    });
  }
  return toFunnelWithStats(copy, await loadFunnelSteps(copy.id));
}

export async function getFunnelStats(
  workspaceId: string,
  id: string,
): Promise<FunnelWithStats['totals'] & { steps: FunnelStepWithStats[] }> {
  const funnel = await getFunnel(workspaceId, id);
  return { ...funnel.totals, steps: funnel.steps };
}

export interface FunnelSubmissionRow {
  id: string;
  submittedAt: Date;
  stepId: string | null;
  answers: unknown;
  contact: { id: string; firstName: string; lastName: string; email: string | null } | null;
}

/** Recent form submissions that came through this funnel, newest first. */
export async function listFunnelSubmissions(
  workspaceId: string,
  id: string,
  limit = 100,
): Promise<FunnelSubmissionRow[]> {
  await loadFunnelOr404(workspaceId, id);
  const rows = await db.formResponse.findMany({
    where: { funnelId: id, workspaceId },
    orderBy: { submittedAt: 'desc' },
    take: limit,
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    submittedAt: r.submittedAt,
    stepId: r.funnelStepId,
    answers: r.answersJson,
    contact: r.contact,
  }));
}
