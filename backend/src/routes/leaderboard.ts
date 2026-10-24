import { Router, Request, Response } from 'express';
import { getTopLeaderboard } from '../db.js';

export const leaderboardRouter = Router();

leaderboardRouter.get('/', async (req: Request, res: Response) => {
  try {
    const kit = typeof req.query.kit === 'string' ? req.query.kit : 'overall';
    const type = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : 'elo';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    // Strict security guarantee: custom kits are never exposed publicly
    if (kit.toLowerCase().startsWith('custom')) {
      return res.json([]);
    }

    const leaderboard = await getTopLeaderboard(kit, type, limit);
    res.json(leaderboard);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve leaderboard', details: err.message });
  }
});
