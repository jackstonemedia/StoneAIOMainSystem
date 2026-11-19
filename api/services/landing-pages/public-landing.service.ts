/**
 * Public landing page service (Wave 1 item 1.1, Slice 3).
 * Unauthenticated by design: the public GET returns only what a visitor
 * may see (no workspaceId, no stats, no draft content). Views are recorded
 * best-effort — a failed view write never breaks the render.
 */
import { db } from '../../../infrastructure/database/client.js';
import { AppError } from '../../middleware/error.js';

export interface PublicLandingPage {
  id: string;
  name: string;
  slug: string;
  seoTitle: string | null;
  seoDesc: string | null;
  sectionsJson: unknown;
}

export async function getPublishedPage(
  slug: string,
): Promise<{ page: PublicLandingPage; workspaceId: string }> {
  const row = await db.landingPage.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      seoTitle: true,
      seoDesc: true,
      sectionsJson: true,
      status: true,
      workspaceId: true,
    },
  });
  if (!row || row.status !== 'published') {
    throw new AppError(404, 'This page is not available.');
  }
  const { status: _status, workspaceId, ...page } = row;
  return { page, workspaceId };
}

export async function recordPageView(
  workspaceId: string,
  pageId: string,
  referrer?: string,
): Promise<void> {
  try {
    await db.landingPageView.create({
      data: { workspaceId, pageId, referrer: referrer || null },
    });
  } catch (e) {
    // Views are analytics, not the render — never fail a visitor's load.
    console.error('[LandingPages] view record failed', e);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD = 500;

function cleanField(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, MAX_FIELD) : '';
}

/**
 * Form submit (Slice 4). Email is required — every valid submission creates
 * or links a contact, so the no-email case cannot happen. Follows the
 * public-booking precedent exactly: match by (workspaceId, email), create
 * with first-word firstName ('Guest' when no name), never modify an
 * existing contact. Deliberately emits NO trigger — submissions do not
 * start automations in v1 (outline 02-21 is a separate item).
 */
export async function submitLandingPageForm(
  slug: string,
  answers: { name?: unknown; email?: unknown; phone?: unknown; message?: unknown },
): Promise<{ success: true }> {
  const { page, workspaceId } = await getPublishedPage(slug);

  const email = cleanField(answers.email).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new AppError(400, 'A valid email address is required.');
  }
  const name = cleanField(answers.name);
  const phone = cleanField(answers.phone);
  const message = cleanField(answers.message);

  const nameParts = name.split(' ');
  const firstName = nameParts[0] || 'Guest';
  const lastName = nameParts.slice(1).join(' ') || '';

  let contact = await db.contact.findFirst({ where: { workspaceId, email } });
  if (!contact) {
    contact = await db.contact.create({
      data: { workspaceId, firstName, lastName, email, phone: phone || undefined, source: 'landing_page' },
    });
  }

  await db.formResponse.create({
    data: {
      workspaceId,
      pageId: page.id,
      contactId: contact.id,
      answersJson: { name, email, phone, message },
    },
  });

  // Same response whether the contact was new or existing — the visitor
  // cannot probe whether an email is already in the CRM.
  return { success: true };
}
