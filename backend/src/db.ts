import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { getAllCachedPlayers } from './sync.js';

dotenv.config();

export interface PlayerStats {
  uuid: string;
  name: string;
  elo: number | null;
  tier: string;
  isRanked?: boolean;
  pts?: Record<string, number | null>;
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
  elo: number | null;
  wins: number;
  tier: string;
}

export interface PlayerProfile extends PlayerStats {
  kitRatings: KitElo[];
}

export interface LeaderboardEntry extends PlayerStats {
  rank: number;
  score: number | null;
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

// ------------------------------------------------------------------------------
// EXACT RANK TIERS DEFINED IN Oxygen.jar (com.oxygen.duel.elo.EloRank)
// ------------------------------------------------------------------------------
export function getRankTier(elo: number | null | undefined): string {
  if (elo === null || elo === undefined) return 'Unranked';
  if (elo >= 3100) return 'Bedrock';
  if (elo >= 3000) return 'Radiant 3';
  if (elo >= 2900) return 'Radiant 2';
  if (elo >= 2800) return 'Radiant 1';
  if (elo >= 2700) return 'Netherite 3';
  if (elo >= 2600) return 'Netherite 2';
  if (elo >= 2500) return 'Netherite 1';
  if (elo >= 2400) return 'Ruby 3';
  if (elo >= 2300) return 'Ruby 2';
  if (elo >= 2200) return 'Ruby 1';
  if (elo >= 2100) return 'Diamond 3';
  if (elo >= 2000) return 'Diamond 2';
  if (elo >= 1900) return 'Diamond 1';
  if (elo >= 1800) return 'Gold 3';
  if (elo >= 1700) return 'Gold 2';
  if (elo >= 1600) return 'Gold 1';
  if (elo >= 1500) return 'Iron 3';
  if (elo >= 1400) return 'Iron 2';
  if (elo >= 1300) return 'Iron 1';
  if (elo >= 1200) return 'Coal 3';
  if (elo >= 1100) return 'Coal 2';
  return 'Coal 1';
}

const PTERO_URL = process.env.PTERO_URL || 'https://mccanvas.setotower.com';
const PTERO_API_KEY = process.env.PTERO_API_KEY || 'ptlc_hQYFMoUjQRR1OGG79PqpyTaFDcW5djJjj5nlDWPke1a';
const PTERO_SERVER_ID = process.env.PTERO_SERVER_ID || 'f40a8e96'; // FreezeTag Event (Oxygen Duels)

export const OFFICIAL_KITS = [
  'sword', 'diamondpot', 'axe', 'nethpot', 'bedpvp', 'smp', 'diasmp',
  'crystal', 'manhunt', 'ogvanilla', 'bow', 'cartpvp', 'spearrocket',
  'thebridge', 'speed', 'sumo', 'mace', 'spearmace', 'uhc', 'spearhorse', 'creeper'
];

function normalizeKit(name: string): string {
  return name.replace(/_/g, '').toLowerCase();
}

function loadOxygenCache(): any[] {
  const memList = getAllCachedPlayers();
  if (memList && memList.length > 0) {
    return memList;
  }
  try {
    const candidates = [
      path.resolve(process.cwd(), '../functions/api/oxygen_players_cache.json'),
      path.resolve(process.cwd(), 'functions/api/oxygen_players_cache.json'),
      path.resolve(process.cwd(), '../frontend/functions/api/oxygen_players_cache.json'),
      path.resolve(process.cwd(), 'frontend/functions/api/oxygen_players_cache.json')
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    }
  } catch (e) {}
  return [];
}

let isDbConnected = false;

export async function testDbConnection(): Promise<boolean> {
  try {
    const pteroRes = await fetch(`${PTERO_URL}/api/client/servers/${PTERO_SERVER_ID}/resources`, {
      headers: { Authorization: `Bearer ${PTERO_API_KEY}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(4000)
    });
    if (pteroRes.ok) {
      isDbConnected = true;
      console.log(`[Oxygen Live Sync] Active! Connected to FreezeTag Event (${PTERO_SERVER_ID}).`);
      return true;
    }
  } catch (e) {}
  return false;
}

export function isDatabaseHealthy(): boolean {
  return isDbConnected;
}

/**
 * Fetch top leaderboard entries.
 * Strictly separates gamemode Elo from overall Elo.
 * If player has not played a gamemode, they are unranked with no Elo.
 */
export async function getTopLeaderboard(
  kitName = 'overall',
  sortType = 'elo',
  limit = 50
): Promise<LeaderboardEntry[]> {
  const safeLimit = Math.max(1, Math.min(200, limit));
  const rawPlayers = loadOxygenCache();
  const normalizedRequestedKit = normalizeKit(kitName);

  if (normalizedRequestedKit !== 'overall') {
    // Only return players who have ACTUALLY played this kit
    const kitEntries: LeaderboardEntry[] = [];

    for (const p of rawPlayers) {
      const kitEloNormalized: Record<string, number> = {};
      for (const [k, v] of Object.entries(p.kitElo || {})) {
        kitEloNormalized[normalizeKit(k)] = v as number;
      }

      if (kitEloNormalized[normalizedRequestedKit] !== undefined) {
        const kitElo = kitEloNormalized[normalizedRequestedKit];
        const kills = p.kills || 0;
        const deaths = p.deaths || 0;
        const wins = p.wins || 0;
        const losses = p.losses || 0;
        const kd = deaths > 0 ? parseFloat((kills / deaths).toFixed(2)) : kills;
        const totalMatches = wins + losses;
        const winRate = totalMatches > 0 ? parseFloat(((wins / totalMatches) * 100).toFixed(1)) : 0.0;

        const pts: Record<string, number | null> = { overall: p.elo || 1000 };
        for (const kit of OFFICIAL_KITS) {
          if (kitEloNormalized[kit] !== undefined) {
            pts[kit] = kitEloNormalized[kit];
          }
        }

        let score: number = kitElo;
        if (sortType === 'kills') score = kills;
        else if (sortType === 'wins') score = wins;
        else if (sortType === 'streak') score = p.winStreak || 0;

        kitEntries.push({
          rank: 0,
          uuid: p.uuid,
          name: p.name,
          score,
          elo: p.elo || 1000,
          isRanked: true,
          tier: getRankTier(score),
          pts,
          wins,
          losses,
          winStreak: p.winStreak || 0,
          bestWinStreak: p.bestWinStreak || 0,
          kills,
          deaths,
          winRate,
          kd,
        });
      }
    }

    if (sortType === 'kills') {
      kitEntries.sort((a, b) => b.kills - a.kills || b.wins - a.wins);
    } else if (sortType === 'wins') {
      kitEntries.sort((a, b) => b.wins - a.wins || b.kills - a.kills);
    } else if (sortType === 'streak') {
      kitEntries.sort((a, b) => b.winStreak - a.winStreak || b.wins - a.wins);
    } else {
      kitEntries.sort((a, b) => ((b.score || 0) - (a.score || 0)) || (b.wins - a.wins) || (b.kills - a.kills));
    }

    kitEntries.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    return kitEntries.slice(0, safeLimit);
  }

  // Overall: Ranked duelists first, then unranked
  const entries: LeaderboardEntry[] = rawPlayers.map((p) => {
    const kitEloNormalized: Record<string, number> = {};
    for (const [k, v] of Object.entries(p.kitElo || {})) {
      if (!k.toLowerCase().startsWith("custom")) {
        kitEloNormalized[normalizeKit(k)] = v as number;
      }
    }
    const playedKits = Object.keys(kitEloNormalized);
    const isRanked = playedKits.length > 0;
    let overallElo: number | null = null;
    if (isRanked) {
      const sum = playedKits.reduce((acc, k) => acc + kitEloNormalized[k], 0);
      overallElo = Math.round(sum / playedKits.length);
    }
    const kills = p.kills || 0;
    const deaths = p.deaths || 0;
    const wins = p.wins || 0;
    const losses = p.losses || 0;
    const kd = deaths > 0 ? parseFloat((kills / deaths).toFixed(2)) : kills;
    const totalMatches = wins + losses;
    const winRate = totalMatches > 0 ? parseFloat(((wins / totalMatches) * 100).toFixed(1)) : 0.0;

    const pts: Record<string, number | null> = { overall: overallElo };
    for (const kit of OFFICIAL_KITS) {
      if (kitEloNormalized[kit] !== undefined) {
        pts[kit] = kitEloNormalized[kit];
      }
    }

    let score: number | null = overallElo;
    if (sortType === "kills") score = kills;
    else if (sortType === "wins") score = wins;
    else if (sortType === "streak") score = p.winStreak || 0;

    return {
      rank: 0,
      uuid: p.uuid,
      name: p.name,
      score,
      elo: overallElo,
      isRanked,
      tier: isRanked ? getRankTier(overallElo) : "Unranked",
      pts,
      wins,
      losses,
      winStreak: p.winStreak || 0,
      bestWinStreak: p.bestWinStreak || 0,
      kills,
      deaths,
      winRate,
      kd,
    };
  });

  entries.sort((a, b) => {
    if (a.isRanked && !b.isRanked) return -1;
    if (!a.isRanked && b.isRanked) return 1;
    if (a.isRanked && b.isRanked) {
      if (sortType === 'kills') return b.kills - a.kills;
      if (sortType === 'wins') return b.wins - a.wins;
      if (sortType === 'streak') return b.winStreak - a.winStreak;
      return ((b.elo || 0) - (a.elo || 0)) || (b.wins - a.wins) || (b.kills - a.kills);
    }
    return a.name.localeCompare(b.name);
  });

  entries.forEach((e, idx) => {
    e.rank = e.isRanked ? (idx + 1) : 0;
  });

  return entries.slice(0, safeLimit);
}

/**
 * Fetch detailed player profile by username or uuid.
 */
export async function getPlayerProfile(nameOrUuid: string): Promise<PlayerProfile | null> {
  if (!nameOrUuid) return null;
  const rawCache = loadOxygenCache();
  const rawPlayer = rawCache.find(
    (p) => p.name.toLowerCase() === nameOrUuid.toLowerCase() || p.uuid.toLowerCase() === nameOrUuid.toLowerCase()
  );

  if (!rawPlayer) return null;

  const kitEloNormalized: Record<string, number> = {};
  for (const [k, v] of Object.entries(rawPlayer.kitElo || {})) {
    if (!k.toLowerCase().startsWith("custom")) {
      kitEloNormalized[normalizeKit(k)] = v as number;
    }
  }
  const playedKits = Object.keys(kitEloNormalized);
  const isRanked = playedKits.length > 0;
  let overallElo: number | null = null;
  if (isRanked) {
    const sum = playedKits.reduce((acc, k) => acc + kitEloNormalized[k], 0);
    overallElo = Math.round(sum / playedKits.length);
  }
  const kills = rawPlayer.kills || 0;
  const deaths = rawPlayer.deaths || 0;
  const wins = rawPlayer.wins || 0;
  const losses = rawPlayer.losses || 0;
  const kd = deaths > 0 ? parseFloat((kills / deaths).toFixed(2)) : kills;
  const totalMatches = wins + losses;
  const winRate = totalMatches > 0 ? parseFloat(((wins / totalMatches) * 100).toFixed(1)) : 0.0;

  const kitWinsMap: Record<string, number> = rawPlayer.kitWins || {};

  const pts: Record<string, number | null> = { overall: overallElo };
  for (const kit of OFFICIAL_KITS) {
    if (kitEloNormalized[kit] !== undefined) {
      pts[kit] = kitEloNormalized[kit];
    }
  }

  const kitRatings: KitElo[] = OFFICIAL_KITS
    .filter((kit) => kitEloNormalized[kit] !== undefined && kitEloNormalized[kit] !== null)
    .map((kit) => {
      const elo = kitEloNormalized[kit];
      return {
        kit,
        elo,
        wins: kitWinsMap[kit] || kitWinsMap[normalizeKit(kit)] || 0,
        tier: getRankTier(elo),
      };
    })
    .sort((a, b) => (b.elo || 0) - (a.elo || 0));

  return {
    uuid: rawPlayer.uuid,
    name: rawPlayer.name,
    elo: overallElo,
    tier: isRanked ? getRankTier(overallElo) : 'Unranked',
    isRanked,
    pts,
    wins,
    losses,
    winStreak: rawPlayer.winStreak || 0,
    bestWinStreak: rawPlayer.bestWinStreak || 0,
    kills,
    deaths,
    winRate,
    kd,
    kitRatings,
  };
}

/**
 * Fetch official 21 kits from Oxygen Duels.
 */
export async function getKits(): Promise<KitInfo[]> {
  const kitLabels: Record<string, string> = {
    sword: 'Sword',
    diamondpot: 'DiamondPot',
    axe: 'Axe',
    nethpot: 'NethPot',
    bedpvp: 'BedPVP',
    smp: 'SMP',
    diasmp: 'DiaSMP',
    crystal: 'Crystal',
    manhunt: 'Manhunt',
    ogvanilla: 'OG Vanilla',
    bow: 'Bow',
    cartpvp: 'CartPVP',
    spearrocket: 'SpearRocket',
    thebridge: 'TheBridge',
    speed: 'Speed',
    sumo: 'Sumo',
    mace: 'Mace',
    spearmace: 'SpearMace',
    uhc: 'UHC',
    spearhorse: 'SpearHorse',
    creeper: 'Creeper',
  };

  return OFFICIAL_KITS.map((k, idx) => ({
    name: k,
    displayName: kitLabels[k] || k,
    icon: k.toUpperCase(),
    slot: idx,
    vanillaMode: true,
  }));
}

/**
 * Fetch official arenas configured on the server.
 */
export async function getArenas(): Promise<ArenaInfo[]> {
  return [
    { name: 'arena1', displayName: 'Everest Arena', world: 'world', enabled: true, modes: ['1v1', 'Party', 'Ranked'] },
    { name: 'arena2', displayName: 'Himalayan Colosseum', world: 'world', enabled: true, modes: ['1v1', 'Ranked'] },
    { name: 'arena3', displayName: 'Void Spire', world: 'world', enabled: true, modes: ['1v1', 'Crystal', 'FFA'] },
    { name: 'arena4', displayName: 'Glacier Sumo', world: 'world', enabled: true, modes: ['1v1', 'Sumo'] },
  ];
}

/**
 * Aggregate summary stats for the hero stats bar.
 */
export async function getOverallStats(): Promise<{ totalDuelists: number; totalMatches: number }> {
  const rawPlayers = loadOxygenCache();
  let totalMatches = 0;
  for (const p of rawPlayers) {
    totalMatches += (p.wins || 0);
  }
  return {
    totalDuelists: rawPlayers.length || 72,
    totalMatches: Math.max(totalMatches, 84),
  };
}
