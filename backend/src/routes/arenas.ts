import { Router, Request, Response } from 'express';
import { getArenas } from '../db.js';

export const arenasRouter = Router();

arenasRouter.get('/', async (req: Request, res: Response) => {
  try {
    const arenas = await getArenas();
    res.json(arenas);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve arenas', details: err.message });
  }
});
