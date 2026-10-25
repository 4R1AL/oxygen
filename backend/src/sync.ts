import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import dotenv from 'dotenv';

dotenv.config();

const PTERO_URL = process.env.PTERO_URL || 'https://mccanvas.setotower.com';
const PTERO_API_KEY = process.env.PTERO_API_KEY || 'ptlc_hQYFMoUjQRR1OGG79PqpyTaFDcW5djJjj5nlDWPke1a';
const PTERO_SERVER_ID = process.env.PTERO_SERVER_ID || 'f40a8e96';

export interface OxygenCachedPlayer {
  uuid: string;
  name: string;
  elo: number | null;
  kitElo: Record<string, number>;
  kitWins: Record<string, number>;
  wins: number;
  losses: number;
  winStreak: number;
  bestWinStreak: number;
  kills: number;
  deaths: number;
  lastModified?: string;
}

// In-memory player map keyed by UUID
const playerStore = new Map<string, OxygenCachedPlayer>();
const fileTimestamps = new Map<string, string>();
let isSyncing = false;
let lastSyncTime = 0;

function getCachePaths(): string[] {
  return [
    path.resolve(process.cwd(), '../functions/api/oxygen_players_cache.json'),
    path.resolve(process.cwd(), 'functions/api/oxygen_players_cache.json'),
    path.resolve(process.cwd(), '../frontend/functions/api/oxygen_players_cache.json'),
    path.resolve(process.cwd(), 'frontend/functions/api/oxygen_players_cache.json'),
  ];
}

// Load existing cache from disk into memory store
export function initializeStoreFromDisk() {
  const paths = getCachePaths();
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(raw)) {
          for (const item of raw) {
            if (item.uuid) {
              playerStore.set(item.uuid, item);
            }
          }
          console.log(`[Oxygen Live Sync] Loaded ${playerStore.size} duelists from disk cache (${p}).`);
          return;
        }
      } catch (e) {}
    }
  }
}

// Save memory store to cache files on disk
function persistStoreToDisk() {
  const list = Array.from(playerStore.values());
  const paths = getCachePaths();
  for (const p of paths) {
    try {
      const dir = path.dirname(p);
      if (fs.existsSync(dir)) {
        fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf8');
      }
    } catch (e) {}
  }
}

export function getAllCachedPlayers(): OxygenCachedPlayer[] {
  return Array.from(playerStore.values());
}

/**
 * Sync player data directly from the Pterodactyl container running Oxygen Duels (server f40a8e96).
 */
export async function syncFromPterodactyl(): Promise<number> {
  if (isSyncing) return 0;
  isSyncing = true;

  let updatedCount = 0;
  try {
    const listUrl = `${PTERO_URL}/api/client/servers/${PTERO_SERVER_ID}/files/list?directory=%2Fplugins%2FOxygen%2Fplayerdata`;
    const res = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${PTERO_API_KEY}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      isSyncing = false;
      return 0;
    }

    const json: any = await res.json();
    const files = json.data || [];

    // Find files that are new or have been modified since last check
    const filesToFetch: string[] = [];
    for (const f of files) {
      const name: string = f.attributes?.name || '';
      if (!name.endsWith('.yml')) continue;

      const modifiedAt: string = f.attributes?.modified_at || '';
      const prev = fileTimestamps.get(name);
      if (!prev || prev !== modifiedAt) {
        filesToFetch.push(name);
        fileTimestamps.set(name, modifiedAt);
      }
    }

    if (filesToFetch.length > 0) {
      console.log(`[Oxygen Live Sync] Syncing ${filesToFetch.length} updated duelist profiles from live server...`);

      // Batch download modified player YAML files (concurrency 5)
      const chunkSize = 5;
      for (let i = 0; i < filesToFetch.length; i += chunkSize) {
        const chunk = filesToFetch.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (filename) => {
            const uuid = filename.replace(/\.yml$/i, '');
            try {
              const fileUrl = `${PTERO_URL}/api/client/servers/${PTERO_SERVER_ID}/files/contents?file=%2Fplugins%2FOxygen%2Fplayerdata%2F${filename}`;
              const fileRes = await fetch(fileUrl, {
                headers: { Authorization: `Bearer ${PTERO_API_KEY}` },
                signal: AbortSignal.timeout(4000),
              });
              if (!fileRes.ok) return;

              const content = await fileRes.text();
              const parsed: any = YAML.parse(content);
              if (!parsed || !parsed.name) return;

              const stats = parsed.stats || {};
              const rawKitElo = stats.kit_elo || {};
              const kitElo: Record<string, number> = {};
              for (const [k, v] of Object.entries(rawKitElo)) {
                if (!k.toLowerCase().startsWith('custom') && typeof v === 'number') {
                  kitElo[k.replace(/_/g, '').toLowerCase()] = v;
                }
              }

              const playedKits = Object.keys(kitElo);
              const isRanked = playedKits.length > 0;
              let overallElo: number | null = null;
              if (isRanked) {
                const sum = playedKits.reduce((acc, k) => acc + kitElo[k], 0);
                overallElo = Math.round(sum / playedKits.length);
              }

              const playerObj: OxygenCachedPlayer = {
                uuid,
                name: parsed.name,
                elo: overallElo,
                kitElo: kitElo,
                kitWins: stats.kit_wins || {},
                wins: stats.wins || 0,
                losses: stats.losses || 0,
                winStreak: stats.win_streak || 0,
                bestWinStreak: stats.best_win_streak || 0,
                kills: stats.kills || 0,
                deaths: stats.deaths || 0,
                lastModified: fileTimestamps.get(filename),
              };

              playerStore.set(uuid, playerObj);
              updatedCount++;
            } catch (err) {}
          })
        );
      }

      if (updatedCount > 0) {
        persistStoreToDisk();
        console.log(`[Oxygen Live Sync] Successfully synced ${updatedCount} duelists! Total duelists in cache: ${playerStore.size}`);
      }
    }

    lastSyncTime = Date.now();
  } catch (err) {
    // Network timeout or temporary failure
  } finally {
    isSyncing = false;
  }

  return updatedCount;
}

export function startLiveSyncDaemon(intervalMs = 30000) {
  initializeStoreFromDisk();
  // Immediate initial sync
  syncFromPterodactyl().catch(() => {});
  // Recurring background interval
  setInterval(() => {
    syncFromPterodactyl().catch(() => {});
  }, intervalMs);
}
