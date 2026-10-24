import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testDbConnection } from './db.js';
import { statusRouter } from './routes/status.js';
import { statsRouter } from './routes/stats.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { playerRouter } from './routes/player.js';
import { kitsRouter } from './routes/kits.js';
import { arenasRouter } from './routes/arenas.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// CORS configuration supporting Cloudflare Pages and local testing
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed.includes('*')) {
          const regex = new RegExp('^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
          return regex.test(origin);
        }
        return allowed === origin;
      });
      callback(null, isAllowed);
    },
    credentials: true,
  })
);

app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    service: 'oxygen-duels-api',
  });
});

// Mount Oxygen REST API endpoints
app.use('/api/status', statusRouter);
app.use('/api/stats', statsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/player', playerRouter);
app.use('/api/kits', kitsRouter);
app.use('/api/arenas', arenasRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// Startup
async function start() {
  console.log('----------------------------------------------------');
  console.log('⚡ Starting Oxygen Duels Web API Server');
  console.log('----------------------------------------------------');

  await testDbConnection();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Oxygen Duels REST API running at: http://localhost:${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Status endpoint: http://localhost:${PORT}/api/status`);
    console.log(`🏆 Leaderboard endpoint: http://localhost:${PORT}/api/leaderboard`);
    console.log('----------------------------------------------------');
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
