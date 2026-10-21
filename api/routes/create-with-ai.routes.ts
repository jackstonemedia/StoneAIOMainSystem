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

export default router;
