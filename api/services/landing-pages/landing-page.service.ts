/**
 * Landing page service (Wave 1 item 1.1 / outline 02-17).
 * Authed CRUD + publish + stats. The public render/submit side lives in
 * api/services/landing-pages/public-landing.service.ts (Slice 3/4).
 */
import { randomUUID } from 'node:crypto';
import { db } from '../../../infrastructure/database/client.js';
import { AppError } from '../../middleware/error.js';
import {
  getLandingPageTemplate,
  type LandingPageSection,
} from './templates.js';

export const LANDING_PAGE_STATUSES = ['draft', 'published'] as const;
export type LandingPageStatus = (typeof LANDING_PAGE_STATUSES)[number];

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;
const SECTION_TYPES = new Set(['hero', 'text', 'image', 'form', 'cta']);

export interface LandingPageStats {
  views: number;
  submissions: number;
  /** Null when there are no views — never a fabricated 0%. */
  conversion: number | null;
}

export interface LandingPageWithStats {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  status: string;
  seoTitle: string | null;
  seoDesc: string | null;
  sectionsJson: unknown;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  stats: LandingPageStats;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64) || 'page';
}

export function validateSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new AppError(
      400,
      'Slug must be 3-64 characters: lowercase letters, numbers, and hyphens, starting with a letter or number.',
    );
  }
}

function validateSections(sections: unknown): LandingPageSection[] {
  if (!Array.isArray(sections)) {
    throw new AppError(400, 'Sections must be an array.');
  }
  for (const s of sections) {
    if (
      typeof s !== 'object' ||
      s === null ||
      typeof (s as { id?: unknown }).id !== 'string' ||
      !SECTION_TYPES.has((s as { type?: string }).type ?? '') ||
      typeof (s as { config?: unknown }).config !== 'object' ||
      (s as { config?: unknown }).config === null
    ) {
      throw new AppError(
        400,
        'Each section needs an id, a valid type (hero, text, image, form, cta), and a config object.',
      );
    }
  }
  return sections as LandingPageSection[];
}

function withFreshIds(sections: LandingPageSection[]): LandingPageSection[] {
  return sections.map((s) => ({ ...s, id: `sec-${randomUUID().slice(0, 8)}` }));
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  let n = 2;
  for (;;) {
    const existing = await db.landingPage.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${n++}`;
  }
}

function toStats(views: number, submissions: number): LandingPageStats {
  return {
    views,
    submissions,
    conversion: views > 0 ? Math.round((submissions / views) * 1000) / 10 : null,
  };
}

function withStats(
  page: {
    id: string;
    workspaceId: string;
    name: string;
    slug: string;
    status: string;
    seoTitle: string | null;
    seoDesc: string | null;
    sectionsJson: unknown;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { views: number; responses: number };
  },
): LandingPageWithStats {
  const { _count, ...rest } = page;
  return { ...rest, stats: toStats(_count.views, _count.responses) };
}

const withCounts = { _count: { select: { views: true, responses: true } } } as const;

export async function listLandingPages(workspaceId: string): Promise<LandingPageWithStats[]> {
  const pages = await db.landingPage.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
    include: withCounts,
  });
  return pages.map(withStats);
}

export async function getLandingPage(workspaceId: string, id: string): Promise<LandingPageWithStats> {
  const page = await db.landingPage.findFirst({
    where: { id, workspaceId },
    include: withCounts,
  });
  if (!page) throw new AppError(404, 'Landing page not found.');
  return withStats(page);
}

export async function createLandingPage(
  workspaceId: string,
  input: {
    name?: unknown;
    slug?: unknown;
    seoTitle?: unknown;
    seoDesc?: unknown;
    sectionsJson?: unknown;
    templateId?: unknown;
  },
): Promise<LandingPageWithStats> {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) throw new AppError(400, 'Name is required.');

  let sections: LandingPageSection[] = [];
  if (typeof input.templateId === 'string' && input.templateId) {
    const template = getLandingPageTemplate(input.templateId);
    if (!template) throw new AppError(400, `Unknown template: ${input.templateId}.`);
    sections = withFreshIds(template.sections);
  } else if (input.sectionsJson !== undefined) {
    sections = validateSections(input.sectionsJson);
  }

  const slugBase =
    typeof input.slug === 'string' && input.slug.trim()
      ? input.slug.trim().toLowerCase()
      : slugify(name);
  validateSlug(slugBase);
  const slug = await uniqueSlug(slugBase);

  const page = await db.landingPage.create({
    data: {
      workspaceId,
      name,
      slug,
      status: 'draft',
      seoTitle: typeof input.seoTitle === 'string' ? input.seoTitle : null,
      seoDesc: typeof input.seoDesc === 'string' ? input.seoDesc : null,
      sectionsJson: sections as unknown as object,
    },
    include: withCounts,
  });
  return withStats(page);
}

export async function updateLandingPage(
  workspaceId: string,
  id: string,
  input: {
    name?: unknown;
    slug?: unknown;
    seoTitle?: unknown;
    seoDesc?: unknown;
    sectionsJson?: unknown;
  },
): Promise<LandingPageWithStats> {
  const page = await db.landingPage.findFirst({ where: { id, workspaceId } });
  if (!page) throw new AppError(404, 'Landing page not found.');

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) throw new AppError(400, 'Name is required.');
    data.name = name;
  }
  if (input.slug !== undefined) {
    // A published page keeps its slug — changing it would break the live URL.
    if (page.status === 'published') {
      throw new AppError(400, 'Unpublish the page before changing its URL slug.');
    }
    const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
    validateSlug(slug);
    data.slug = await uniqueSlug(slug, id);
  }
  if (input.seoTitle !== undefined) {
    data.seoTitle = typeof input.seoTitle === 'string' ? input.seoTitle : null;
  }
  if (input.seoDesc !== undefined) {
    data.seoDesc = typeof input.seoDesc === 'string' ? input.seoDesc : null;
  }
  if (input.sectionsJson !== undefined) {
    data.sectionsJson = validateSections(input.sectionsJson);
  }

  const updated = await db.landingPage.update({
    where: { id },
    data,
    include: withCounts,
  });
  return withStats(updated);
}

export async function deleteLandingPage(workspaceId: string, id: string): Promise<void> {
  const page = await db.landingPage.findFirst({ where: { id, workspaceId } });
  if (!page) throw new AppError(404, 'Landing page not found.');
  // Explicit child deletes: the dev scaffold DB carries no FK cascades, so
  // Prisma's onDelete: Cascade cannot be relied on here.
  await db.$transaction([
    db.landingPageView.deleteMany({ where: { pageId: id } }),
    db.formResponse.deleteMany({ where: { pageId: id } }),
    db.landingPage.delete({ where: { id } }),
  ]);
}

export async function publishLandingPage(workspaceId: string, id: string): Promise<LandingPageWithStats> {
  const page = await db.landingPage.findFirst({ where: { id, workspaceId } });
  if (!page) throw new AppError(404, 'Landing page not found.');
  const sections = Array.isArray(page.sectionsJson) ? page.sectionsJson : [];
  if (sections.length === 0) {
    throw new AppError(400, 'Add at least one section before publishing.');
  }
  const published = await db.landingPage.update({
    where: { id },
    data: { status: 'published', publishedAt: new Date() },
    include: withCounts,
  });
  return withStats(published);
}

export async function unpublishLandingPage(workspaceId: string, id: string): Promise<LandingPageWithStats> {
  const page = await db.landingPage.findFirst({ where: { id, workspaceId } });
  if (!page) throw new AppError(404, 'Landing page not found.');
  const updated = await db.landingPage.update({
    where: { id },
    data: { status: 'draft', publishedAt: null },
    include: withCounts,
  });
  return withStats(updated);
}

export async function duplicateLandingPage(workspaceId: string, id: string): Promise<LandingPageWithStats> {
  const page = await db.landingPage.findFirst({ where: { id, workspaceId } });
  if (!page) throw new AppError(404, 'Landing page not found.');
  const sections = Array.isArray(page.sectionsJson)
    ? withFreshIds(page.sectionsJson as unknown as LandingPageSection[])
    : [];
  const slug = await uniqueSlug(`${page.slug}-copy`);
  const copy = await db.landingPage.create({
    data: {
      workspaceId,
      name: `${page.name} (copy)`,
      slug,
      status: 'draft',
      seoTitle: page.seoTitle,
      seoDesc: page.seoDesc,
      sectionsJson: sections as unknown as object,
    },
    include: withCounts,
  });
  return withStats(copy);
}

export async function getLandingPageStats(workspaceId: string, id: string): Promise<LandingPageStats> {
  const page = await db.landingPage.findFirst({
    where: { id, workspaceId },
    include: withCounts,
  });
  if (!page) throw new AppError(404, 'Landing page not found.');
  return toStats(page._count.views, page._count.responses);
}
