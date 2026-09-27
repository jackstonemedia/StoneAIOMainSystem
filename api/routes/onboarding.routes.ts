import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../infrastructure/database/client.js';
import { validate } from '../middleware/validate.js';

interface AuthRequest {
  userId?: string;
  workspaceId?: string;
}

const updateProgressSchema = {
  params: z.object({
    tourKey: z.string().min(1, 'tourKey is required'),
  }),
  body: z.object({
    status: z.enum(['not_started', 'in_progress', 'completed', 'skipped']).default('in_progress'),
    stepIndex: z.coerce.number().int().min(0).default(0),
  }),
};

const resetProgressSchema = {
  body: z.object({
    tourKey: z.string().optional(),
  }),
};

const router = Router();
async function getOrCreateUser(clerkId: string) {
  let user = await db.user.findUnique({ where: { clerkId } });
  if (!user) {
    user = await db.user.create({ data: { clerkId } });
  }
  return user;
}

// ── GET /api/onboarding/progress ──────────────────────────────
router.get('/onboarding/progress', async (req, res) => {
  try {
    const clerkId = (req as any).userId || 'test_user_new';
    const user = await getOrCreateUser(clerkId);

    const rows = await db.userOnboardingProgress.findMany({
      where: { userId: user.id },
    });

    const progressMap: Record<string, { status: string; stepIndex: number; completedAt?: string }> = {};
    for (const row of rows) {
      progressMap[row.tourKey] = {
        status: row.status,
        stepIndex: row.stepIndex,
        completedAt: row.completedAt ? row.completedAt.toISOString() : undefined,
      };
    }

    return res.json({ progress: progressMap });
  } catch (error: any) {
    console.error('[Onboarding API] Error fetching progress:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch onboarding progress' });
  }
});

// ── PUT /api/onboarding/progress/:tourKey ──────────────────────────────
router.put('/onboarding/progress/:tourKey', validate(updateProgressSchema), async (req, res) => {
  try {
    const clerkId = (req as any).userId || 'test_user_new';
    const { tourKey } = req.params;
    const { status, stepIndex } = req.body;

    if (!tourKey) {
      return res.status(400).json({ error: 'tourKey is required' });
    }

    const user = await getOrCreateUser(clerkId);
    const isCompleted = status === 'completed';

    const progress = await db.userOnboardingProgress.upsert({
      where: {
        userId_tourKey: {
          userId: user.id,
          tourKey,
        },
      },
      create: {
        userId: user.id,
        tourKey,
        status,
        stepIndex: Number(stepIndex) || 0,
        completedAt: isCompleted ? new Date() : null,
      },
      update: {
        status,
        stepIndex: Number(stepIndex) || 0,
        completedAt: isCompleted ? new Date() : undefined,
      },
    });

    return res.json({
      success: true,
      tourKey: progress.tourKey,
      status: progress.status,
      stepIndex: progress.stepIndex,
      completedAt: progress.completedAt,
    });
  } catch (error: any) {
    console.error('[Onboarding API] Error saving progress:', error);
    return res.status(500).json({ error: error.message || 'Failed to save onboarding progress' });
  }
});

// ── POST /api/onboarding/reset ────────────────────────────────────────
router.post('/onboarding/reset', validate(resetProgressSchema), async (req, res) => {
  try {
    const clerkId = (req as any).userId || 'test_user_new';
    const { tourKey } = req.body;
    const user = await getOrCreateUser(clerkId);

    if (tourKey) {
      await db.userOnboardingProgress.deleteMany({
        where: { userId: user.id, tourKey },
      });
    } else {
      await db.userOnboardingProgress.deleteMany({
        where: { userId: user.id },
      });
    }

    return res.json({ success: true, message: tourKey ? `Reset ${tourKey} tour` : 'Reset all tours' });
  } catch (error: any) {
    console.error('[Onboarding API] Error resetting progress:', error);
    return res.status(500).json({ error: error.message || 'Failed to reset onboarding progress' });
  }
});

export default router;
