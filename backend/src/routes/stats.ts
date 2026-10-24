import { Router, Request, Response } from 'express';
import { getOverallStats } from '../db.js';
import { getServerStatus } from '../ping.js';

export const statsRouter = Router();

statsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const [stats, mcStatus] = await Promise.all([
      getOverallStats(),
      getServerStatus(),
    ]);

    res.json({
      onlinePlayers: mcStatus.onlinePlayers,
      totalDuelists: stats.totalDuelists,
      totalMatches: stats.totalMatches,
      serverName: mcStatus.serverName,
      serverIp: mcStatus.serverIp,
      version: mcStatus.version,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve stats', details: err.message });
  }
});
