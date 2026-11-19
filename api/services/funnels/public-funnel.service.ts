/**
 * Public funnel service (Wave 1 item 1.2, Slice 3).
 * Unauthenticated by design: the public GET returns only what a visitor may
 * see (no workspaceId, no stats, no draft content). Step views are recorded
 * best-effort — a failed view write never breaks the render.
 *
 * Submission follows the public-landing precedent exactly: match the contact
 * by (workspaceId, email), create with first-word firstName ('Guest' when
 * no name), never overwrite an existing contact's data. Two funnel-only
 * additions: the step's tag is APPENDED to the contact's tags (the funnel's
 * stated purpose — feeding the contact into a segment that matches the
 * tag), and the contact is enrolled as a PENDING recipient of the step's
 * campaign, if one is set and still exists. Emits form.submitted (Slice 1c)
 * so FORM_SUBMITTED automations fire — the old "no trigger in v1" note died
 * with the runner.
 */
import { db } from '../../../infrastructure/database/client.js';
import { AppError } from '../../middleware/error.js';
import { emitTrigger } from '../trigger-emitter.service.js';

export interface PublicFunnelStep {
  funnelId: string;
  funnelName: string;
  funnelSlug: string;
  stepId: string;
  stepNumber: number;
  totalSteps: number;
  offerTitle: string | null;
  offerBody: string | null;
  page: {
    id: string;
    name: string;
    slug: string;
    seoTitle: string | null;
    seoDesc: string | null;
    sectionsJson: unknown;
  };
  /** 1-based number of the next step, or null on the last step. */
  nextStep: number | null;
}

async function loadPublishedFunnel(slug: string) {
  const funnel = await db.funnel.findUnique({
    where: { slug },
    include: {
      steps: {
        orderBy: { position: 'asc' },
        include: {
          landingPage: {
            select: {
              id: true,
              name: true,
              slug: true,
              seoTitle: true,
              seoDesc: true,
              sectionsJson: true,
              status: true,
            },
          },
        },
      },
    },
  });
  if (!funnel || funnel.status !== 'published') {
    throw new AppError(404, 'This funnel is not available.');
  }
  return funnel;
}

export async function getPublishedFunnelStep(
  slug: string,
  stepNumber: number,
): Promise<{ step: PublicFunnelStep; workspaceId: string }> {
  const funnel = await loadPublishedFunnel(slug);
  if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > funnel.steps.length) {
    throw new AppError(404, 'This funnel step is not available.');
  }
  const step = funnel.steps[stepNumber - 1];
  const page = step.landingPage;
  if (!page || page.status !== 'published') {
    throw new AppError(404, 'This funnel step is not available.');
  }
  // Pick the visitor-safe fields explicitly — a spread would leak anything
  // the query happens to return (workspaceId, status).
  const safePage = {
    id: page.id,
    name: page.name,
    slug: page.slug,
    seoTitle: page.seoTitle,
    seoDesc: page.seoDesc,
    sectionsJson: page.sectionsJson,
  };
  return {
    step: {
      funnelId: funnel.id,
      funnelName: funnel.name,
      funnelSlug: funnel.slug,
      stepId: step.id,
      stepNumber,
      totalSteps: funnel.steps.length,
      offerTitle: step.offerTitle,
      offerBody: step.offerBody,
      page: safePage,
      nextStep: stepNumber < funnel.steps.length ? stepNumber + 1 : null,
    },
    workspaceId: funnel.workspaceId,
  };
}

export async function recordFunnelStepView(
  workspaceId: string,
  funnelId: string,
  stepId: string,
  referrer?: string,
): Promise<void> {
  try {
    await db.funnelStepView.create({
      data: { workspaceId, funnelId, stepId, referrer: referrer || null },
    });
  } catch (e) {
    // Views are analytics, not the render — never fail a visitor's load.
    console.error('[Funnels] step view record failed', e);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD = 500;

function cleanField(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, MAX_FIELD) : '';
}

async function applyTag(workspaceId: string, contactId: string, tag: string): Promise<void> {
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    select: { tagsJson: true },
  });
  if (!contact) return;
  let tags: unknown[] = [];
  try {
    tags = JSON.parse(contact.tagsJson || '[]');
  } catch {
    tags = [];
  }
  if (!Array.isArray(tags)) tags = [];
  if (!tags.includes(tag)) {
    tags.push(tag);
    await db.contact.update({
      where: { id: contactId },
      data: { tagsJson: JSON.stringify(tags) },
    });
    // Slice 1c: the step tag was really added — fire TAG_ADDED automations.
    emitTrigger(workspaceId, 'contact.tag_added', { contactId, tag }).catch(() => {});
  }
}

async function enrollInCampaign(campaignId: string, contactId: string): Promise<void> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) return; // The campaign was deleted after the funnel published — skip, don't fail the submit.
  const existing = await db.campaignRecipient.findFirst({
    where: { campaignId, contactId },
  });
  if (existing) return; // A repeat submission enrolls once, not twice.
  await db.campaignRecipient.create({
    data: { campaignId, contactId, status: 'PENDING' },
  });
}

export async function submitFunnelStepForm(
  slug: string,
  stepNumber: number,
  answers: { name?: unknown; email?: unknown; phone?: unknown; message?: unknown },
): Promise<{ success: true; nextStep: number | null }> {
  const { step, workspaceId } = await getPublishedFunnelStep(slug, stepNumber);

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
  const isNewContact = !contact;
  if (!contact) {
    contact = await db.contact.create({
      data: { workspaceId, firstName, lastName, email, phone: phone || undefined, source: 'funnel' },
    });
  }

  // The funnel's own effects: tag + campaign enrollment. These run before
  // the response is stored so the attribution is complete either way.
  const funnelStep = await db.funnelStep.findUnique({
    where: { id: step.stepId },
    select: { tagOnSubmit: true, campaignId: true },
  });
  if (funnelStep?.tagOnSubmit) {
    await applyTag(workspaceId, contact.id, funnelStep.tagOnSubmit);
  }
  if (funnelStep?.campaignId) {
    await enrollInCampaign(funnelStep.campaignId, contact.id);
  }

  await db.formResponse.create({
    data: {
      workspaceId,
      pageId: step.page.id,
      contactId: contact.id,
      answersJson: { name, email, phone, message },
      funnelId: step.funnelId,
      funnelStepId: step.stepId,
    },
  });

  // Slice 1c: a real funnel-step submission — fire FORM_SUBMITTED
  // automations (pageId = the step's landing page, so page-scoped configs
  // match). A genuinely NEW contact is also a contact.created event — this
  // path creates contacts directly, not via crm.createContact.
  if (isNewContact) {
    emitTrigger(workspaceId, 'contact.created', { contactId: contact.id, email, source: 'funnel' }).catch(() => {});
  }
  emitTrigger(workspaceId, 'form.submitted', { contactId: contact.id, pageId: step.page.id }).catch(() => {});

  // Same response whether the contact was new or existing — the visitor
  // cannot probe whether an email is already in the CRM.
  return { success: true, nextStep: step.nextStep };
}
