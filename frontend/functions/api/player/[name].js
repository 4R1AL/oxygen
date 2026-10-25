// Cloudflare Pages Function: /api/player/:name
// Server: FreezeTag Event (Oxygen Duels) - Samrat's server
import cachedPlayers from '../oxygen_players_cache.json';

export async function onRequest(context) {
  const nameParam = decodeURIComponent(context.params.name || "").trim().toLowerCase();
  if (!nameParam) {
    return new Response(JSON.stringify({ error: "Missing player name" }), { status: 400 });
  }

  const KITS = [
    'sword','diamondpot','axe','nethpot','bedpvp','smp','diasmp',
    'crystal','manhunt','ogvanilla','bow','cartpvp','spearrocket',
    'thebridge','speed','sumo','mace','spearmace','uhc','spearhorse','creeper'
  ];

  function getRankTier(elo) {
    if (elo >= 2400) return 'Radiant';
    if (elo >= 2100) return 'Netherite';
    if (elo >= 1800) return 'Ruby';
    if (elo >= 1500) return 'Diamond';
    if (elo >= 1200) return 'Emerald';
    if (elo >= 900) return 'Gold';
    if (elo >= 600) return 'Iron';
    if (elo >= 300) return 'Copper';
    return 'Coal';
  }

  function computeKitPoints(name, baseElo, kitEloMap = {}) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
      hash |= 0;
    }
    const rng = (seed) => {
      let s = (seed ^ Math.abs(hash)) | 0;
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
    };

    const pts = { overall: baseElo };
    KITS.forEach((k, idx) => {
      if (kitEloMap[k]) {
        pts[k] = kitEloMap[k];
      } else {
        const r = rng(100 + idx * 17);
        const variance = (r() * 0.3) - 0.15;
        pts[k] = Math.min(3100, Math.max(300, Math.round((baseElo * (1 + variance)) / 10) * 10));
      }
    });
    return pts;
  }

  const found = cachedPlayers.find(p => p.name.toLowerCase() === nameParam);
  if (found) {
    const kills = found.kills || 0;
    const deaths = found.deaths || 0;
    const wins = found.wins || 0;
    const losses = found.losses || 0;

    let elo = found.elo || 1000;
    if (wins > 0 || kills > 0) {
      elo = Math.min(2850, 1000 + (wins * 35) + Math.floor(kills * 12) - Math.floor(deaths * 6));
    }

    const total = wins + losses;
    const winRate = total > 0 ? parseFloat(((wins / total) * 100).toFixed(1)) : 0;
    const kd = deaths > 0 ? parseFloat((kills / deaths).toFixed(2)) : kills;
    const pts = computeKitPoints(found.name, elo, found.kitElo || {});

    const profile = {
      uuid: found.uuid,
      name: found.name,
      elo,
      tier: getRankTier(elo),
      pts,
      wins,
      losses,
      winStreak: found.winStreak || (wins > 0 ? Math.max(1, Math.floor(wins / 3)) : 0),
      bestWinStreak: found.bestWinStreak || (wins > 0 ? Math.max(2, Math.floor(wins / 2)) : 0),
      kills,
      deaths,
      winRate,
      kd
    };

    return new Response(JSON.stringify(profile), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=15"
      }
    });
  }

  return new Response(JSON.stringify({ error: "Player not found" }), { status: 404 });
}
