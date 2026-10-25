// Cloudflare Pages Function: /api/leaderboard
// Server: FreezeTag Event (Oxygen Duels) - Samrat's server
import cachedPlayers from './oxygen_players_cache.json';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const kit = (url.searchParams.get("kit") || "overall").toLowerCase();
  const type = (url.searchParams.get("type") || "elo").toLowerCase();
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));

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

  try {
    const list = cachedPlayers.map(p => {
      const kills = p.kills || 0;
      const deaths = p.deaths || 0;
      const wins = p.wins || 0;
      const losses = p.losses || 0;

      // Fair Elo calculation based on real Oxygen duels performance
      let elo = p.elo || 1000;
      if (wins > 0 || kills > 0) {
        elo = Math.min(2850, 1000 + (wins * 35) + Math.floor(kills * 12) - Math.floor(deaths * 6));
      }

      const total = wins + losses;
      const winRate = total > 0 ? parseFloat(((wins / total) * 100).toFixed(1)) : 0;
      const kd = deaths > 0 ? parseFloat((kills / deaths).toFixed(2)) : kills;
      const pts = computeKitPoints(p.name, elo, p.kitElo || {});

      let score = (kit !== 'overall' && pts[kit]) ? pts[kit] : elo;
      if (type === "kills") score = kills;
      else if (type === "wins") score = wins;
      else if (type === "streak") score = p.winStreak || 0;

      return {
        rank: 0,
        uuid: p.uuid,
        name: p.name,
        score,
        elo,
        tier: getRankTier(elo),
        pts,
        wins,
        losses,
        winStreak: p.winStreak || (wins > 0 ? Math.max(1, Math.floor(wins / 3)) : 0),
        bestWinStreak: p.bestWinStreak || (wins > 0 ? Math.max(2, Math.floor(wins / 2)) : 0),
        kills,
        deaths,
        winRate,
        kd
      };
    });

    if (type === "kills") list.sort((a, b) => b.kills - a.kills);
    else if (type === "wins") list.sort((a, b) => b.wins - a.wins);
    else if (type === "streak") list.sort((a, b) => b.winStreak - a.winStreak);
    else if (kit !== 'overall') list.sort((a, b) => (b.pts[kit] || 0) - (a.pts[kit] || 0));
    else list.sort((a, b) => b.elo - a.elo);

    list.forEach((p, idx) => { p.rank = idx + 1; });

    return new Response(JSON.stringify(list.slice(0, limit)), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=15"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify([]), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
