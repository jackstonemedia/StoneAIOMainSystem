import { Router } from 'express';
import { 
  listAPPieces, 
  getAPPiece, 
  getAPDynamicOptions 
} from './services/activepieces.service.js';

const router = Router();

// ── Piece Registry API ────────────────────────────────────────────────────────
// Proxy to the Activepieces CE engine to list available pieces and fetch their schemas.

/**
 * List all available pieces.
 */
router.get('/', async (req, res, next) => {
  try {
    const { includeHidden, searchQuery } = req.query;
    
    const pieces = await listAPPieces({
      includeHidden: includeHidden === 'true',
      searchQuery: searchQuery as string | undefined,
    });
    
    res.json(pieces);
  } catch (error) {
    next(error);
  }
});

/**
 * Get the exact schema (actions, triggers, props) for a specific piece.
 */
router.get('/:pieceName', async (req, res, next) => {
  try {
    const { pieceName } = req.params;
    const { version } = req.query;
    
    const piece = await getAPPiece(pieceName, version as string | undefined);
    res.json(piece);
  } catch (error) {
    next(error);
  }
});

/**
 * Resolve dynamic dropdown options for a piece property.
 */
router.post('/:pieceName/options', async (req, res, next) => {
  try {
    const { pieceName } = req.params;
    const payload = req.body;
    
    const options = await getAPDynamicOptions(pieceName, payload);
    res.json(options);
  } catch (error) {
    next(error);
  }
});

export const piecesRouter = router;
