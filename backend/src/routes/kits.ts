import { Router, Request, Response } from 'express';
import { getKits } from '../db.js';

export const kitsRouter = Router();

kitsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const kits = await getKits();
    res.json(kits);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve kits', details: err.message });
  }
});
