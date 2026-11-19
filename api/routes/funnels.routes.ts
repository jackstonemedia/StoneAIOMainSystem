/**
 * Funnels routes — thin HTTP controller layer (Wave 1 item 1.2).
 * All logic lives in api/services/funnels/funnel.service.ts.
 * Errors flow to the central errorHandler via next(err), so AppError
 * statuses (400/404) surface honestly instead of collapsing to 500.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import * as svc from '../services/funnels/funnel.service.js';

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

// ── List + create ───────────────────────────────────────────────────────────
router.get(
  '/',
  wrap(async (req, res) => {
    res.json(await svc.listFunnels(req.workspaceId));
  }),
);

router.post(
  '/',
  wrap(async (req, res) => {
    res.status(201).json(await svc.createFunnel(req.workspaceId, req.body ?? {}));
  }),
);

// ── One funnel ──────────────────────────────────────────────────────────────
router.get(
  '/:id',
  wrap(async (req, res) => {
    res.json(await svc.getFunnel(req.workspaceId, req.params.id));
  }),
);

router.put(
  '/:id',
  wrap(async (req, res) => {
    res.json(await svc.updateFunnel(req.workspaceId, req.params.id, req.body ?? {}));
  }),
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    await svc.deleteFunnel(req.workspaceId, req.params.id);
    res.json({ success: true });
  }),
);

// ── Publish lifecycle ───────────────────────────────────────────────────────
router.post(
  '/:id/publish',
  wrap(async (req, res) => {
    res.json(await svc.publishFunnel(req.workspaceId, req.params.id));
  }),
);

router.post(
  '/:id/unpublish',
  wrap(async (req, res) => {
    res.json(await svc.unpublishFunnel(req.workspaceId, req.params.id));
  }),
);

router.post(
  '/:id/duplicate',
  wrap(async (req, res) => {
    res.status(201).json(await svc.duplicateFunnel(req.workspaceId, req.params.id));
  }),
);

// ── Stats + submissions ─────────────────────────────────────────────────────
router.get(
  '/:id/stats',
  wrap(async (req, res) => {
    res.json(await svc.getFunnelStats(req.workspaceId, req.params.id));
  }),
);

router.get(
  '/:id/submissions',
  wrap(async (req, res) => {
    res.json(await svc.listFunnelSubmissions(req.workspaceId, req.params.id));
  }),
);

export default router;
