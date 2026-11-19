/**
 * Landing Pages routes — thin HTTP controller layer (Wave 1 item 1.1).
 * All logic lives in api/services/landing-pages/landing-page.service.ts.
 * Errors flow to the central errorHandler via next(err), so AppError
 * statuses (400/404) surface honestly instead of collapsing to 500.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import * as svc from '../services/landing-pages/landing-page.service.js';
import { LANDING_PAGE_TEMPLATES } from '../services/landing-pages/templates.js';

const router = Router();

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
const wrap = (fn: (req: Request, res: Response) => Promise<void>): Handler =>
  async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (err) {
      next(err);
    }
  };

// ── Templates (no workspace scoping — the same 3 starters for everyone) ─────
router.get(
  '/templates',
  wrap(async (_req, res) => {
    res.json(LANDING_PAGE_TEMPLATES);
  }),
);

// ── List + create ───────────────────────────────────────────────────────────
router.get(
  '/',
  wrap(async (req, res) => {
    res.json(await svc.listLandingPages(req.workspaceId));
  }),
);

router.post(
  '/',
  wrap(async (req, res) => {
    res.status(201).json(await svc.createLandingPage(req.workspaceId, req.body ?? {}));
  }),
);

// ── One page ────────────────────────────────────────────────────────────────
router.get(
  '/:id',
  wrap(async (req, res) => {
    res.json(await svc.getLandingPage(req.workspaceId, req.params.id));
  }),
);

router.put(
  '/:id',
  wrap(async (req, res) => {
    res.json(await svc.updateLandingPage(req.workspaceId, req.params.id, req.body ?? {}));
  }),
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    await svc.deleteLandingPage(req.workspaceId, req.params.id);
    res.json({ success: true });
  }),
);

// ── Publish / unpublish / duplicate ─────────────────────────────────────────
router.post(
  '/:id/publish',
  wrap(async (req, res) => {
    res.json(await svc.publishLandingPage(req.workspaceId, req.params.id));
  }),
);

router.post(
  '/:id/unpublish',
  wrap(async (req, res) => {
    res.json(await svc.unpublishLandingPage(req.workspaceId, req.params.id));
  }),
);

router.post(
  '/:id/duplicate',
  wrap(async (req, res) => {
    res.status(201).json(await svc.duplicateLandingPage(req.workspaceId, req.params.id));
  }),
);

// ── Stats ───────────────────────────────────────────────────────────────────
router.get(
  '/:id/stats',
  wrap(async (req, res) => {
    res.json(await svc.getLandingPageStats(req.workspaceId, req.params.id));
  }),
);

// ── Responses (Slice 5 — analytics: who submitted, newest first) ────────────
router.get(
  '/:id/responses',
  wrap(async (req, res) => {
    res.json(await svc.listLandingPageResponses(req.workspaceId, req.params.id));
  }),
);

export default router;
