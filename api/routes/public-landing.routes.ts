/**
 * Public landing page routes (Wave 1 item 1.1, Slices 3-4).
 * Mounted BEFORE resolveWorkspace in server.ts — no JWT, no workspace,
 * no 2FA gate. Rate-limited by the global /api limiter (300/min/IP).
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import * as pub from '../services/landing-pages/public-landing.service.js';

const router = Router();

router.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, workspaceId } = await pub.getPublishedPage(req.params.slug);
    // Record the view without awaiting it: a slow/failed write must never
    // delay or break the visitor's page load.
    void pub.recordPageView(workspaceId, page.id, req.get('referer'));
    res.json(page);
  } catch (err) {
    next(err);
  }
});

router.post('/:slug/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await pub.submitLandingPageForm(req.params.slug, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

export default router;
