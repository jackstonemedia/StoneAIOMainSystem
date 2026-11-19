/**
 * Public funnel routes (Wave 1 item 1.2, Slice 3).
 * Mounted BEFORE resolveWorkspace in server.ts — no JWT, no workspace,
 * no 2FA gate. Rate-limited by the global /api limiter (300/min/IP).
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import * as pub from '../services/funnels/public-funnel.service.js';

const router = Router();

router.get('/:slug/:step', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stepNumber = Number(req.params.step);
    const { step, workspaceId } = await pub.getPublishedFunnelStep(req.params.slug, stepNumber);
    // Record the view without awaiting it: a slow/failed write must never
    // delay or break the visitor's page load.
    void pub.recordFunnelStepView(workspaceId, step.funnelId, step.stepId, req.get('referer'));
    res.json(step);
  } catch (err) {
    next(err);
  }
});

router.post('/:slug/:step/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stepNumber = Number(req.params.step);
    res
      .status(201)
      .json(await pub.submitFunnelStepForm(req.params.slug, stepNumber, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

export default router;
