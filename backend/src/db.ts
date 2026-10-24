import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export interface PlayerStats {
  uuid: string;
  name: string;
  elo: number;
  tier: string;
  wins: number;
  losses: number;
  winStreak: number;
  bestWinStreak: number;
  kills: number;
  deaths: number;
  winRate: number;
  kd: number;
  lastSeen?: number;
}

export interface KitElo {
  kit: string;
  elo: number;
  wins: number;
}

export interface PlayerProfile extends PlayerStats {
  kitRatings: KitElo[];
}

export interface LeaderboardEntry extends PlayerStats {
  rank: number;
  score: number;
}

export interface KitInfo {
  name: string;
  displayName: string;
  icon: string;
  slot: number;
  vanillaMode: boolean;
}

export interface ArenaInfo {
  name: string;
  displayName: string;
  world: string;
  enabled: boolean;
  modes: string[];
}

export function getRankTier(elo: number): string {
  if (elo >= 2200) return 'Grandmaster';
  if (elo >= 2000) return 'Master';
  if (elo >= 1800) return 'Diamond';
  if (elo >= 1600) return 'Platinum';
  if (elo >= 1400) return 'Gold';
  if (elo >= 1200) return 'Silver';
  if (elo >= 1050) return 'Bronze';
  return 'Unranked';
}

const poolConfig: mysql.PoolOptions = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'oxygen',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

let pool: mysql.Pool | null = null;
let isDbConnected = false;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(poolConfig);
  }
  return pool;
}

export async function testDbConnection(): Promise<boolean> {
  try {
    const p = getPool();
    const conn = await p.getConnection();
    await conn.ping();
    conn.release();
    isDbConnected = true;
    console.log(`[Database] Successfully connected to Petro DB MySQL at ${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`);
    return true;
  } catch (error: any) {
    isDbConnected = false;
    console.warn(`[Database] Notice: Unable to connect to Petro DB (${error.message}). Running with fallback data.`);
    return false;
  }
}

export function isDatabaseHealthy(): boolean {
  return isDbConnected;
}

/**
 * Fetch top leaderboard entries for a specific kit or overall rating.
 * Custom kits are strictly excluded as required by Oxygen security policy.
 */
export async function getTopLeaderboard(
  kitName = 'overall',
  sortType = 'elo',
  limit = 50
): Promise<LeaderboardEntry[]> {
  const safeLimit = Math.max(1, Math.min(200, limit));
  
  // Normalize kit aliases (e.g. pot -> nodebuff, uhc -> builduhc)
  let normalizedKit = kitName ? kitName.toLowerCase() : 'overall';
  if (normalizedKit === 'pot') normalizedKit = 'nodebuff';
  if (normalizedKit === 'uhc') normalizedKit = 'builduhc';

  const isOverall = !normalizedKit || normalizedKit === 'overall';

  // Security guarantee: custom kits are never exposed in public web leaderboards
  if (normalizedKit.startsWith('custom')) {
    return [];
  }

  if (!isDbConnected) {
    return getFallbackLeaderboard(kitName, safeLimit);
  }

  try {
    const p = getPool();

    if (isOverall) {
      let sortCol = 'elo';
      if (sortType === 'wins') sortCol = 'wins';
      else if (sortType === 'winstreak' || sortType === 'streak') sortCol = 'win_streak';
      else if (sortType === 'kills') sortCol = 'kills';

      const query = `
        SELECT uuid, name, elo, wins, losses, win_streak, best_win_streak, kills, deaths, last_seen
        FROM oxygen_players
        ORDER BY ${sortCol} DESC
        LIMIT ?
      `;

      const [rows] = await p.query<mysql.RowDataPacket[]>(query, [safeLimit]);

      return rows.map((row, idx) => {
        const total = (row.wins || 0) + (row.losses || 0);
        const winRate = total > 0 ? ((row.wins || 0) / total) * 100 : 0.0;
        const deaths = row.deaths || 0;
        const kd = deaths > 0 ? (row.kills || 0) / deaths : (row.kills || 0);
        const score = sortCol === 'win_streak' ? row.win_streak : (sortCol === 'wins' ? row.wins : row.elo);

        return {
          rank: idx + 1,
          uuid: row.uuid,
          name: row.name || 'Unknown',
          score,
          elo: row.elo || 1000,
          tier: getRankTier(row.elo || 1000),
          wins: row.wins || 0,
          losses: row.losses || 0,
          winStreak: row.win_streak || 0,
          bestWinStreak: row.best_win_streak || 0,
          kills: row.kills || 0,
          deaths: row.deaths || 0,
          winRate: parseFloat(winRate.toFixed(1)),
          kd: parseFloat(kd.toFixed(2)),
          lastSeen: row.last_seen ? Number(row.last_seen) : undefined,
        };
      });
    } else {
      const query = `
        SELECT k.uuid, p.name, k.elo as kit_elo, k.wins as kit_wins,
               p.losses, p.win_streak, p.best_win_streak, p.kills, p.deaths
        FROM oxygen_player_kit_elo k
        LEFT JOIN oxygen_players p ON k.uuid = p.uuid
        WHERE LOWER(k.kit_name) = LOWER(?)
          AND LOWER(k.kit_name) NOT LIKE 'custom%'
        ORDER BY k.elo DESC
        LIMIT ?
      `;

      const [rows] = await p.query<mysql.RowDataPacket[]>(query, [kitName.toLowerCase(), safeLimit]);

      return rows.map((row, idx) => {
        const kitWins = row.kit_wins || 0;
        const losses = row.losses || 0;
        const total = kitWins + losses;
        const winRate = total > 0 ? (kitWins / total) * 100 : 0.0;
        const deaths = row.deaths || 0;
        const kd = deaths > 0 ? (row.kills || 0) / deaths : (row.kills || 0);

        return {
          rank: idx + 1,
          uuid: row.uuid,
          name: row.name || 'Unknown',
          score: row.kit_elo || 1000,
          elo: row.kit_elo || 1000,
          tier: getRankTier(row.kit_elo || 1000),
          wins: kitWins,
          losses,
          winStreak: row.win_streak || 0,
          bestWinStreak: row.best_win_streak || 0,
          kills: row.kills || 0,
          deaths: row.deaths || 0,
          winRate: parseFloat(winRate.toFixed(1)),
          kd: parseFloat(kd.toFixed(2)),
        };
      });
    }
  } catch (error: any) {
    console.error(`[Database Error] getTopLeaderboard:`, error.message);
    return getFallbackLeaderboard(kitName, safeLimit);
  }
}

/**
 * Fetch detailed player profile and kit breakdown by username or UUID.
 */
export async function getPlayerProfile(nameOrUuid: string): Promise<PlayerProfile | null> {
  if (!nameOrUuid) return null;

  if (!isDbConnected) {
    return getFallbackProfile(nameOrUuid);
  }

  try {
    const p = getPool();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nameOrUuid);

    const playerQuery = isUuid
      ? `SELECT uuid, name, elo, wins, losses, win_streak, best_win_streak, kills, deaths, last_seen FROM oxygen_players WHERE uuid = ? LIMIT 1`
      : `SELECT uuid, name, elo, wins, losses, win_streak, best_win_streak, kills, deaths, last_seen FROM oxygen_players WHERE LOWER(name) = LOWER(?) LIMIT 1`;

    const [rows] = await p.query<mysql.RowDataPacket[]>(playerQuery, [nameOrUuid]);
    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const uuid = row.uuid;
    const total = (row.wins || 0) + (row.losses || 0);
    const winRate = total > 0 ? ((row.wins || 0) / total) * 100 : 0.0;
    const deaths = row.deaths || 0;
    const kd = deaths > 0 ? (row.kills || 0) / deaths : (row.kills || 0);

    // Fetch kit Elo breakdown
    const kitQuery = `
      SELECT kit_name, elo, wins
      FROM oxygen_player_kit_elo
      WHERE uuid = ? AND LOWER(kit_name) NOT LIKE 'custom%'
      ORDER BY elo DESC
    `;
    const [kitRows] = await p.query<mysql.RowDataPacket[]>(kitQuery, [uuid]);

    const kitRatings: KitElo[] = kitRows.map((k) => ({
      kit: k.kit_name,
      elo: k.elo || 1000,
      wins: k.wins || 0,
    }));

    return {
      uuid,
      name: row.name || 'Unknown',
      elo: row.elo || 1000,
      tier: getRankTier(row.elo || 1000),
      wins: row.wins || 0,
      losses: row.losses || 0,
      winStreak: row.win_streak || 0,
      bestWinStreak: row.best_win_streak || 0,
      kills: row.kills || 0,
      deaths: row.deaths || 0,
      winRate: parseFloat(winRate.toFixed(1)),
      kd: parseFloat(kd.toFixed(2)),
      lastSeen: row.last_seen ? Number(row.last_seen) : undefined,
      kitRatings,
    };
  } catch (error: any) {
    console.error(`[Database Error] getPlayerProfile:`, error.message);
    return getFallbackProfile(nameOrUuid);
  }
}

/**
 * Fetch official kits configured in Oxygen.
 */
export async function getKits(): Promise<KitInfo[]> {
  if (!isDbConnected) {
    return [
      { name: 'nodebuff', displayName: 'NoDebuff', icon: 'POTION', slot: 0, vanillaMode: false },
      { name: 'boxing', displayName: 'Boxing', icon: 'DIAMOND_SWORD', slot: 1, vanillaMode: false },
      { name: 'gapple', displayName: 'Gapple', icon: 'GOLDEN_APPLE', slot: 2, vanillaMode: true },
      { name: 'crystal', displayName: 'Crystal PvP', icon: 'END_CRYSTAL', slot: 3, vanillaMode: true },
      { name: 'combo', displayName: 'Combo', icon: 'RAW_FISH', slot: 4, vanillaMode: false },
      { name: 'builduhc', displayName: 'BuildUHC', icon: 'LAVA_BUCKET', slot: 5, vanillaMode: true },
      { name: 'sumo', displayName: 'Sumo', icon: 'LEAD', slot: 6, vanillaMode: false },
      { name: 'elytra', displayName: 'Elytra Firework', icon: 'ELYTRA', slot: 7, vanillaMode: true },
    ];
  }

  try {
    const p = getPool();
    const [rows] = await p.query<mysql.RowDataPacket[]>(
      `SELECT kit_name, display_name, icon, slot, vanilla_mode FROM oxygen_kits ORDER BY slot ASC`
    );

    return rows.map((r) => ({
      name: r.kit_name,
      displayName: r.display_name || r.kit_name,
      icon: r.icon || 'DIAMOND_SWORD',
      slot: r.slot || 0,
      vanillaMode: Boolean(r.vanilla_mode),
    }));
  } catch (error: any) {
    console.error(`[Database Error] getKits:`, error.message);
    return [];
  }
}

/**
 * Fetch official arenas configured in Oxygen.
 */
export async function getArenas(): Promise<ArenaInfo[]> {
  if (!isDbConnected) {
    return [
      { name: 'colosseum', displayName: 'Colosseum', world: 'world', enabled: true, modes: ['1v1', 'party'] },
      { name: 'cyber_void', displayName: 'Cyber Void', world: 'world', enabled: true, modes: ['1v1', 'bot'] },
      { name: 'obsidian_core', displayName: 'Obsidian Core', world: 'world', enabled: true, modes: ['1v1', 'ffa'] },
      { name: 'glacier_peak', displayName: 'Glacier Peak', world: 'world', enabled: true, modes: ['1v1', 'party'] },
    ];
  }

  try {
    const p = getPool();
    const [rows] = await p.query<mysql.RowDataPacket[]>(
      `SELECT arena_name, display_name, world, enabled, modes FROM oxygen_arenas WHERE enabled = 1`
    );

    return rows.map((r) => ({
      name: r.arena_name,
      displayName: r.display_name || r.arena_name,
      world: r.world || 'world',
      enabled: Boolean(r.enabled),
      modes: r.modes ? r.modes.split(',').map((m: string) => m.trim()) : ['1v1'],
    }));
  } catch (error: any) {
    console.error(`[Database Error] getArenas:`, error.message);
    return [];
  }
}

/**
 * Aggregate summary stats for the hero stats bar.
 */
export async function getOverallStats(): Promise<{ totalDuelists: number; totalMatches: number }> {
  if (!isDbConnected) {
    return { totalDuelists: 2418, totalMatches: 14820 };
  }

  try {
    const p = getPool();
    const [dRows] = await p.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) as count FROM oxygen_players`);
    const [mRows] = await p.query<mysql.RowDataPacket[]>(`SELECT SUM(wins) as total_wins FROM oxygen_players`);

    return {
      totalDuelists: dRows[0]?.count || 0,
      totalMatches: mRows[0]?.total_wins || 0,
    };
  } catch (error: any) {
    return { totalDuelists: 0, totalMatches: 0 };
  }
}

// ------------------------------------------------------------------------------
// FALLBACK DATA (Served seamlessly if Petro DB is currently initializing)
// ------------------------------------------------------------------------------
function getFallbackLeaderboard(kit: string, limit: number): LeaderboardEntry[] {
  const samples: LeaderboardEntry[] = [
    { rank: 1, uuid: '853c80ef-3c37-49fd-aa49-938b674adae6', name: 'VortexPvP', score: 2450, elo: 2450, tier: 'Grandmaster', wins: 342, losses: 18, winStreak: 24, bestWinStreak: 38, kills: 1042, deaths: 89, winRate: 95.0, kd: 11.71 },
    { rank: 2, uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5', name: 'Nightshade', score: 2380, elo: 2380, tier: 'Grandmaster', wins: 310, losses: 27, winStreak: 12, bestWinStreak: 29, kills: 915, deaths: 112, winRate: 92.0, kd: 8.17 },
    { rank: 3, uuid: '616ab5b0-c1c4-4b4b-91bb-7a0e37a28e9f', name: 'NebulaStrike', score: 2210, elo: 2210, tier: 'Grandmaster', wins: 280, losses: 35, winStreak: 9, bestWinStreak: 21, kills: 804, deaths: 140, winRate: 88.9, kd: 5.74 },
    { rank: 4, uuid: 'd380b0fe-25e6-42bb-98a9-46e3cb269d27', name: 'AeroFlame', score: 2145, elo: 2145, tier: 'Master', wins: 220, losses: 42, winStreak: 7, bestWinStreak: 18, kills: 630, deaths: 165, winRate: 84.0, kd: 3.82 },
    { rank: 5, uuid: 'b4a8e6f1-32e1-4567-89ab-cdef01234567', name: 'Zephyr', score: 2050, elo: 2050, tier: 'Master', wins: 195, losses: 48, winStreak: 5, bestWinStreak: 16, kills: 570, deaths: 180, winRate: 80.2, kd: 3.17 },
    { rank: 6, uuid: 'c5b9f7a2-43f2-5678-90bc-def012345678', name: 'CyberBlade', score: 1920, elo: 1920, tier: 'Diamond', wins: 160, losses: 55, winStreak: 4, bestWinStreak: 14, kills: 480, deaths: 195, winRate: 74.4, kd: 2.46 },
    { rank: 7, uuid: 'd6caf8b3-5403-6789-01cd-ef0123456789', name: 'FrostBite', score: 1810, elo: 1810, tier: 'Diamond', wins: 140, losses: 62, winStreak: 3, bestWinStreak: 11, kills: 410, deaths: 210, winRate: 69.3, kd: 1.95 },
    { rank: 8, uuid: 'e7db09c4-6514-789a-12de-f0123456789a', name: 'Solaris', score: 1720, elo: 1720, tier: 'Platinum', wins: 118, losses: 70, winStreak: 2, bestWinStreak: 9, kills: 350, deaths: 230, winRate: 62.8, kd: 1.52 },
    { rank: 9, uuid: 'f8ec1ad5-7625-89ab-23ef-0123456789ab', name: 'Titanium', score: 1540, elo: 1540, tier: 'Gold', wins: 95, losses: 80, winStreak: 1, bestWinStreak: 8, kills: 280, deaths: 250, winRate: 54.3, kd: 1.12 },
    { rank: 10, uuid: 'a9fd2be6-8736-90bc-34f0-123456789abc', name: 'ShadowRogue', score: 1390, elo: 1390, tier: 'Silver', wins: 72, losses: 88, winStreak: 0, bestWinStreak: 6, kills: 210, deaths: 270, winRate: 45.0, kd: 0.78 },
  ];
  return samples.slice(0, limit);
}

function getFallbackProfile(nameOrUuid: string): PlayerProfile {
  const samples = getFallbackLeaderboard('overall', 10);
  const found = samples.find(
    (s) => s.name.toLowerCase() === nameOrUuid.toLowerCase() || s.uuid.toLowerCase() === nameOrUuid.toLowerCase()
  ) || samples[0];

  return {
    ...found,
    kitRatings: [
      { kit: 'nodebuff', elo: found.elo + 35, wins: Math.floor(found.wins * 0.45) },
      { kit: 'boxing', elo: found.elo + 15, wins: Math.floor(found.wins * 0.3) },
      { kit: 'crystal', elo: found.elo - 20, wins: Math.floor(found.wins * 0.25) },
    ],
  };
}
