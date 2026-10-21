/**
 * Create with AI routes — Business Profile, Writing Samples, Website Prefill.
 * Mounted by email-marketing.routes.ts at /api/email-marketing/create-with-ai.
 * All routes are workspace-scoped via req.workspaceId (resolveWorkspace).
 *
 *   GET    /profile                      (profile + samples + missing required)
 *   POST   /profile                      (create/replace, full validation)
 *   PATCH  /profile                      (partial update, merged then validated)
 *   DELETE /profile
 *   POST   /samples                      (paste or base64 upload)
 *   PATCH  /samples/:sampleId            (title/content/summary/approve)
 *   DELETE /samples/:sampleId
 *   POST   /samples/:sampleId/style-summary (Gemini; 503 when AI unconfigured)
 *   POST   /prefill                      (website suggestions; saves NOTHING)
 */

import { Router, type Request, type Response } from 'express';
import {
  getProfile,
  upsertProfile,
  deleteProfile,
  addSample,
  updateSample,
  deleteSample,
  generateStyleSummary,
  missingRequiredFields,
  type ProfileInput,
} from '../services/email-marketing/business-profile.service.js';
import { prefillFromWebsite } from '../services/email-marketing/website-prefill.service.js';
import {
  generateEmail,
  generateSequenceEmails,
  refineEmail,
  directEditEmail,
  undoEmail,
  consistencyCheck,
  acceptFacts,
  getEmailOrThrow,
  emailToState,
  DraftError,
} from '../services/email-marketing/draft-generator.service.js';
import {
  resolveRecipients,
  suggestFilterFromHints,
  coverageForSelected,
  getRecipientSources,
  RecipientError,
  type ListHints,
} from '../services/email-marketing/recipients.service.js';
import {
  runSendChecks,
  testSendEmail,
  simulatePath,
  recommendedStartFor,
  confirmSend,
  confirmSequenceSend,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  campaignStatus,
  SendError,
} from '../services/email-marketing/send-orchestration.service.js';
import { usedTokens } from '../services/email-marketing/fact-validator.js';
import { db } from '../../infrastructure/database/client.js';
import {
  createDraft,
  getDraft,
  listDrafts,
  deleteDraft,
  runTurn,
  retryTurn,
  escapeHatch,
  reopenPhase,
  confirmBrief,
  startSequence,
  refreshSnapshot,
  InterviewError,
  type PhaseId,
} from '../services/email-marketing/interview.service.js';

const router = Router();

function getWid(req: Request): string {
  const wid = (req as any).workspaceId as string;
  if (!wid) throw new Error('workspaceId not resolved — resolveWorkspace middleware missing');
  return wid;
}

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err: Error & { status?: number; fields?: Record<string, string> }) => {
      console.error('[CreateWithAI] Route error:', err.message);
      res.status(err.status || 500).json({ error: err.message || 'Internal server error', fields: err.fields });
    });
  };
}

// ── Profile ────────────────────────────────────────────────────────────────────

router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const profile = await getProfile(getWid(req));
    if (!profile) {
      res.json({ profile: null, samples: [], missingRequired: missingRequiredFields(null) });
      return;
    }
    const { samples, ...rest } = profile as typeof profile & { samples: unknown[] };
    res.json({ profile: rest, samples, missingRequired: missingRequiredFields(rest as Record<string, unknown>) });
  }),
);

router.post(
  '/profile',
  asyncHandler(async (req, res) => {
    const profile = await upsertProfile(getWid(req), (req.body || {}) as ProfileInput);
    res.json({ profile });
  }),
);

router.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const wid = getWid(req);
    const existing = await getProfile(wid);
    if (!existing) {
      res.status(404).json({ error: 'No Business Profile found. Create one first.' });
      return;
    }
    const { samples: _samples, id: _id, workspaceId: _ws, createdAt: _c, updatedAt: _u, ...current } = existing as Record<string, unknown>;
    const merged = { ...current, ...(req.body || {}) } as ProfileInput;
    const profile = await upsertProfile(wid, merged);
    res.json({ profile });
  }),
);

router.delete(
  '/profile',
  asyncHandler(async (req, res) => {
    await deleteProfile(getWid(req));
    res.json({ ok: true });
  }),
);

// ── Writing Samples ──────────────────────────────────────────────────────────

router.post(
  '/samples',
  asyncHandler(async (req, res) => {
    const sample = await addSample(getWid(req), req.body || {});
    res.json({ sample });
  }),
);

router.patch(
  '/samples/:sampleId',
  asyncHandler(async (req, res) => {
    const sample = await updateSample(getWid(req), req.params.sampleId, req.body || {});
    res.json({ sample });
  }),
);

router.delete(
  '/samples/:sampleId',
  asyncHandler(async (req, res) => {
    await deleteSample(getWid(req), req.params.sampleId);
    res.json({ ok: true });
  }),
);

router.post(
  '/samples/:sampleId/style-summary',
  asyncHandler(async (req, res) => {
    const sample = await generateStyleSummary(getWid(req), req.params.sampleId);
    res.json({ sample });
  }),
);

// ── Website Prefill (saves nothing) ──────────────────────────────────────────

router.post(
  '/prefill',
  asyncHandler(async (req, res) => {
    const websiteUrl = typeof req.body?.websiteUrl === 'string' ? req.body.websiteUrl.trim() : '';
    if (!websiteUrl) {
      res.status(400).json({ error: 'Enter a website link first.' });
      return;
    }
    try {
      const result = await prefillFromWebsite(websiteUrl);
      res.json(result);
    } catch (err) {
      // A failed fetch is a normal outcome: say so, let the user continue manually.
      res.status(400).json({ error: err instanceof Error ? err.message : 'Could not fetch that website.', failed: true });
    }
  }),
);

// ── Interview drafts (Milestone 2) ─────────────────────────────────────────
// All routes are workspace-scoped. A draft is blank except for the Business
// Profile snapshot — no new campaign ever reads another campaign's draft.

function draftError(err: unknown, res: Response): void {
  if (err instanceof InterviewError) {
    res.status(err.status).json({ error: err.message, saved: err.saved });
    return;
  }
  console.error('[CreateWithAI] Draft route error:', err instanceof Error ? err.message : err);
  res.status(500).json({ error: 'Internal server error' });
}

router.post(
  '/drafts',
  asyncHandler(async (req, res) => {
    try {
      const draft = await createDraft(getWid(req));
      res.json({ draft });
    } catch (err) {
      draftError(err, res);
    }
  }),
);

router.get(
  '/drafts',
  asyncHandler(async (req, res) => {
    try {
      const drafts = await listDrafts(getWid(req));
      res.json({ drafts });
    } catch (err) {
      draftError(err, res);
    }
  }),
);

router.get(
  '/drafts/:draftId',
  asyncHandler(async (req, res) => {
    try {
      const draft = await getDraft(getWid(req), req.params.draftId);
      res.json({ draft });
    } catch (err) {
      draftError(err, res);
    }
  }),
);

router.delete(
  '/drafts/:draftId',
  asyncHandler(async (req, res) => {
    try {
      await deleteDraft(getWid(req), req.params.draftId);
      res.json({ ok: true });
    } catch (err) {
      draftError(err, res);
    }
  }),
);

router.post(
  '/drafts/:draftId/turn',
  asyncHandler(async (req, res) => {
    try {
      const result = await runTurn(getWid(req), req.params.draftId, req.body?.message || '');
      res.json(result);
    } catch (err) {
      draftError(err, res);
    }
  }),
);

router.post(
  '/drafts/:draftId/retry',
  asyncHandler(async (req, res) => {
    try {
      const result = await retryTurn(getWid(req), req.params.draftId);
      res.json(result);
    } catch (err) {
      draftError(err, res);
    }
  }),
);

router.post(
  '/drafts/:draftId/escape-hatch',
  asyncHandler(async (req, res) => {
    try {
      const draft = await escapeHatch(getWid(req), req.params.draftId);
      res.json({ draft });
    } catch (err) {
      draftError(err, res);
    }
  }),
);

router.post(
  '/drafts/:draftId/reopen',
  asyncHandler(async (req, res) => {
    try {
      const phase = req.body?.phase as PhaseId;
      const draft = await reopenPhase(getWid(req), req.params.draftId, phase);
      res.json({ draft });
    } catch (err) {
      draftError(err, res);
    }
  }),
);

router.post(
  '/drafts/:draftId/confirm-brief',
  asyncHandler(async (req, res) => {
    try {
      const result = await confirmBrief(getWid(req), req.params.draftId, req.body?.confirmation || '');
      res.json(result);
    } catch (err) {
      draftError(err, res);
    }
  }),
);

router.post(
  '/drafts/:draftId/start-sequence',
  asyncHandler(async (req, res) => {
    try {
      const draft = await startSequence(getWid(req), req.params.draftId);
      res.json({ draft });
    } catch (err) {
      draftError(err, res);
    }
  }),
);

router.post(
  '/drafts/:draftId/snapshot',
  asyncHandler(async (req, res) => {
    try {
      const action = req.body?.action as 'regenerate' | 'keep';
      if (action !== 'regenerate' && action !== 'keep') {
        res.status(400).json({ error: 'action must be "regenerate" or "keep".' });
        return;
      }
      const draft = await refreshSnapshot(getWid(req), req.params.draftId, action);
      res.json({ draft });
    } catch (err) {
      draftError(err, res);
    }
  }),
);

// ── Draft + Refine (Milestone 3, Phase 7) ───────────────────────────────────
// All routes are workspace-scoped. Generation needs a locked Brief; AI
// unavailability is an honest 503, never a fabricated draft.

function m3Error(err: unknown, res: Response): void {
  if (err instanceof DraftError || err instanceof RecipientError || err instanceof SendError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[CreateWithAI] M3 route error:', err instanceof Error ? err.message : err);
  res.status(500).json({ error: 'Internal server error' });
}

function listHintsOf(draft: any): ListHints {
  const brief = (draft?.brief || {}) as Record<string, any>;
  return ((brief?.audience?.list_hints || {}) as ListHints) || {};
}

router.post(
  '/drafts/:draftId/generate-email',
  asyncHandler(async (req, res) => {
    try {
      const email = await generateEmail(getWid(req), req.params.draftId);
      res.json({ email });
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/drafts/:draftId/generate-sequence',
  asyncHandler(async (req, res) => {
    try {
      const emails = await generateSequenceEmails(getWid(req), req.params.draftId);
      res.json({ emails });
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/drafts/:draftId/confirm-sequence',
  asyncHandler(async (req, res) => {
    try {
      const result = await confirmSequenceSend(getWid(req), req.params.draftId, {
        idempotencyKey: req.body?.idempotencyKey || '',
        campaignName: req.body?.campaignName || '',
        sendNow: !!req.body?.sendNow,
        sendAt: req.body?.sendAt || null,
        coldAck: !!req.body?.coldAck,
      });
      res.json(result);
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.get(
  '/drafts/:draftId/sequence-status',
  asyncHandler(async (req, res) => {
    try {
      const { getSequenceStatus } = await import('../services/email-marketing/sequence-runner.service.js');
      res.json(await getSequenceStatus(getWid(req), req.params.draftId));
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/drafts/:draftId/sequence-exit',
  asyncHandler(async (req, res) => {
    try {
      const reason = req.body?.reason as 'replied' | 'booked' | 'unsubscribed';
      if (!['replied', 'booked', 'unsubscribed'].includes(reason)) {
        res.status(400).json({ error: 'reason must be replied, booked, or unsubscribed.' });
        return;
      }
      const { exitSequenceContact } = await import('../services/email-marketing/sequence-runner.service.js');
      res.json(await exitSequenceContact(getWid(req), req.params.draftId, req.body?.contactId || '', reason));
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.get(
  '/drafts/:draftId/emails',
  asyncHandler(async (req, res) => {
    try {
      const rows = await db.campaignEmail.findMany({
        where: { draftId: req.params.draftId, workspaceId: getWid(req) },
        orderBy: { order: 'asc' },
      });
      res.json({ emails: rows.map(emailToState) });
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.get(
  '/emails/:emailId',
  asyncHandler(async (req, res) => {
    try {
      const row = await getEmailOrThrow(getWid(req), req.params.emailId);
      res.json({ email: emailToState(row) });
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.patch(
  '/emails/:emailId',
  asyncHandler(async (req, res) => {
    try {
      const b = req.body || {};
      const email = await directEditEmail(getWid(req), req.params.emailId, {
        subjectVariants: Array.isArray(b.subjectVariants) ? b.subjectVariants : undefined,
        subjectSelected: typeof b.subjectSelected === 'number' ? b.subjectSelected : undefined,
        previewText: typeof b.previewText === 'string' ? b.previewText : undefined,
        bodyHtml: typeof b.bodyHtml === 'string' ? b.bodyHtml : undefined,
        bodyText: typeof b.bodyText === 'string' ? b.bodyText : undefined,
      });
      res.json({ email });
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/emails/:emailId/refine',
  asyncHandler(async (req, res) => {
    try {
      const scope = req.body?.scope as 'whole' | 'subject' | 'opening' | 'body' | 'cta' | 'signoff' | undefined;
      const email = await refineEmail(getWid(req), req.params.emailId, req.body?.instruction || '', scope || 'whole');
      res.json({ email });
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/emails/:emailId/undo',
  asyncHandler(async (req, res) => {
    try {
      const email = await undoEmail(getWid(req), req.params.emailId);
      res.json({ email });
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/emails/:emailId/accept-facts',
  asyncHandler(async (req, res) => {
    try {
      const claims = Array.isArray(req.body?.claims) ? req.body.claims : [];
      const email = await acceptFacts(getWid(req), req.params.emailId, claims);
      res.json({ email });
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.get(
  '/emails/:emailId/versions',
  asyncHandler(async (req, res) => {
    try {
      const row = await getEmailOrThrow(getWid(req), req.params.emailId);
      const versions = (Array.isArray(row.versions) ? row.versions : []) as unknown[];
      res.json({ versions, count: versions.length });
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/emails/:emailId/consistency-check',
  asyncHandler(async (req, res) => {
    try {
      const result = await consistencyCheck(getWid(req), req.params.emailId);
      res.json(result);
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

// ── Review and Send (Milestone 3, Phase 8) ──────────────────────────────────

router.get(
  '/recipient-sources',
  asyncHandler(async (req, res) => {
    try {
      res.json(await getRecipientSources(getWid(req)));
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/drafts/:draftId/recipients/suggest-filter',
  asyncHandler(async (req, res) => {
    try {
      const draft = await db.campaignDraft.findFirst({ where: { id: req.params.draftId, workspaceId: getWid(req) } });
      if (!draft) {
        res.status(404).json({ error: 'Campaign draft not found' });
        return;
      }
      res.json(suggestFilterFromHints(listHintsOf(draft)));
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/drafts/:draftId/recipients/resolve',
  asyncHandler(async (req, res) => {
    try {
      const wid = getWid(req);
      const b = req.body || {};
      const sourceType = b.sourceType as 'segment' | 'smartList' | 'list' | 'csv' | undefined;
      if (!sourceType || !['segment', 'smartList', 'list', 'csv'].includes(sourceType)) {
        res.status(400).json({ error: 'sourceType must be segment, smartList, list, or csv.' });
        return;
      }
      const draft = await db.campaignDraft.findFirst({ where: { id: req.params.draftId, workspaceId: wid } });
      if (!draft) {
        res.status(404).json({ error: 'Campaign draft not found' });
        return;
      }
      const resolution = await resolveRecipients(wid, sourceType, b.sourceId || null, b.csvText || null, listHintsOf(draft));
      // Token coverage for the selected audience (spec §13).
      const emails = await db.campaignEmail.findMany({ where: { draftId: req.params.draftId, workspaceId: wid }, orderBy: { order: 'asc' } });
      const tokens = emails.length > 0
        ? usedTokens([emails[0].subjectVariants, emails[0].previewText, emails[0].bodyHtml, emails[0].bodyText].map((x) => String(x || '')).join('\n'))
        : [];
      const coverage = coverageForSelected(
        resolution.selected.map((s) => ({ firstName: s.firstName, lastName: s.lastName, company: s.company, phone: s.phone })),
        tokens,
      );
      // Persist the selection on the draft email's receivesRule so confirm
      // re-resolves the same audience (spec §18: re-check before send).
      if (emails.length > 0) {
        await db.campaignEmail.update({
          where: { id: emails[0].id },
          data: {
            receivesRule: {
              sourceType: resolution.sourceType,
              sourceId: resolution.sourceId,
              sourceName: resolution.sourceName,
              recipientCount: resolution.selected.length,
              excluded: resolution.excluded.map((g) => ({ key: g.key, label: g.label, count: g.count })),
              mismatch: resolution.mismatch,
              tokenCoverage: coverage,
              csvText: sourceType === 'csv' ? b.csvText || null : null,
              resolvedAt: new Date().toISOString(),
            },
          },
        });
      }
      res.json({ ...resolution, tokenCoverage: coverage, tokensUsed: tokens });
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/emails/:emailId/checks',
  asyncHandler(async (req, res) => {
    try {
      const wid = getWid(req);
      const email = await getEmailOrThrow(wid, req.params.emailId);
      const receives = (email.receivesRule || {}) as Record<string, any>;
      let recipientCount = typeof receives.recipientCount === 'number' ? receives.recipientCount : 0;
      // M4: a sequence shares ONE audience (picked once, stored on Email 1).
      // Emails 2..N have no receivesRule of their own — checking them
      // against zero would false-block. Fall back to Email 1's count.
      if (recipientCount === 0 && email.order > 1) {
        const draft = await db.campaignDraft.findFirst({ where: { id: email.draftId, workspaceId: wid } });
        const seq = (draft?.sequence || {}) as { count?: number };
        if (seq.count && seq.count > 1) {
          const first = await db.campaignEmail.findFirst({ where: { draftId: email.draftId, workspaceId: wid, order: 1 } });
          const firstReceives = (first?.receivesRule || {}) as Record<string, any>;
          if (typeof firstReceives.recipientCount === 'number') recipientCount = firstReceives.recipientCount;
        }
      }
      const sendAt = req.body?.sendAt ? new Date(req.body.sendAt) : null;
      res.json(await runSendChecks(wid, req.params.emailId, recipientCount, sendAt && !Number.isNaN(sendAt.getTime()) ? sendAt : null));
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/emails/:emailId/test-send',
  asyncHandler(async (req, res) => {
    try {
      const addresses = Array.isArray(req.body?.addresses) ? req.body.addresses : [];
      res.json(await testSendEmail(getWid(req), req.params.emailId, addresses));
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.get(
  '/emails/:emailId/path-simulator',
  asyncHandler(async (req, res) => {
    try {
      const scenario = typeof req.query.scenario === 'string' ? req.query.scenario : 'clicked';
      res.json(simulatePath(scenario));
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.get(
  '/drafts/:draftId/recommended-start',
  asyncHandler(async (req, res) => {
    try {
      res.json(await recommendedStartFor(getWid(req), req.params.draftId));
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/emails/:emailId/confirm-send',
  asyncHandler(async (req, res) => {
    try {
      const b = req.body || {};
      res.json(
        await confirmSend(getWid(req), req.params.emailId, {
          idempotencyKey: b.idempotencyKey || '',
          campaignName: b.campaignName || 'Create with AI campaign',
          sendNow: !!b.sendNow,
          sendAt: b.sendAt || null,
          coldAck: !!b.coldAck,
        }),
      );
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.get(
  '/campaigns/:campaignId',
  asyncHandler(async (req, res) => {
    try {
      res.json(await campaignStatus(getWid(req), req.params.campaignId));
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/campaigns/:campaignId/pause',
  asyncHandler(async (req, res) => {
    try {
      res.json(await pauseCampaign(getWid(req), req.params.campaignId));
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/campaigns/:campaignId/resume',
  asyncHandler(async (req, res) => {
    try {
      res.json(await resumeCampaign(getWid(req), req.params.campaignId));
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

router.post(
  '/campaigns/:campaignId/cancel',
  asyncHandler(async (req, res) => {
    try {
      res.json(await cancelCampaign(getWid(req), req.params.campaignId));
    } catch (err) {
      m3Error(err, res);
    }
  }),
);

export default router;
