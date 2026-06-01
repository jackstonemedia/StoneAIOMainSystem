import { Router } from 'express';
import { db } from '../../infrastructure/database/client.js';

const router = Router();

// GET /api/releases
router.get('/', async (req, res) => {
  try {
    const releases = await db.release.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(releases);
  } catch (error: any) {
    if (error.code === 'P2021') return res.json([]);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/releases
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    const release = await db.release.create({
      data: {
        workspaceId: req.workspaceId,
        name: name || `Release ${new Date().toISOString().slice(0, 10)}`,
        description,
        status: 'PUBLISHED',
      },
    });
    res.status(201).json(release);
  } catch (error: any) {
    if (error.code === 'P2021') {
      return res.status(503).json({ error: 'Releases table not yet created. Run prisma migrate dev.' });
    }
    res.status(500).json({ error: error.message });
  }
});

export const releasesRouter = router;
