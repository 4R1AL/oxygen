import { Router, Request, Response } from 'express';
import { getServerStatus } from '../ping.js';
import { isDatabaseHealthy } from '../db.js';

export const statusRouter = Router();

statusRouter.get('/', async (req: Request, res: Response) => {
  try {
    const mcStatus = await getServerStatus();
    res.json({
      status: mcStatus.online ? 'online' : 'offline',
      database: isDatabaseHealthy() ? 'connected' : 'disconnected',
      serverName: mcStatus.serverName,
      serverIp: mcStatus.serverIp,
      version: mcStatus.version,
      onlinePlayers: mcStatus.onlinePlayers,
      maxPlayers: mcStatus.maxPlayers,
      motd: mcStatus.motd,
      ping: mcStatus.ping,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve server status', details: err.message });
  }
});
