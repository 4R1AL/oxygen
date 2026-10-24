import { Router, Request, Response } from 'express';
import { getPlayerProfile } from '../db.js';

export const playerRouter = Router();

playerRouter.get('/:nameOrUuid', async (req: Request, res: Response) => {
  try {
    const query = req.params.nameOrUuid ? decodeURIComponent(req.params.nameOrUuid).trim() : '';
    if (!query) {
      return res.status(400).json({ error: 'Missing player parameter' });
    }

    const profile = await getPlayerProfile(query);
    if (!profile) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve player profile', details: err.message });
  }
});
