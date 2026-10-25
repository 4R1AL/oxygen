// Cloudflare Pages Function: /api/player/:name
export async function onRequest(context) {
  const nameParam = decodeURIComponent(context.params.name || "").trim();
  if (!nameParam) {
    return new Response(JSON.stringify({ error: "Missing player name" }), { status: 400 });
  }

  const pteroUrl = "https://mccanvas.setotower.com";
  const pteroKey = "ptlc_hQYFMoUjQRR1OGG79PqpyTaFDcW5djJjj5nlDWPke1a";
  const pteroServerId = "f0d45844";

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

  function generateUuid(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `${hex}-0000-4000-8000-${hex.repeat(2).substring(0, 12)}`;
  }

  function computeKitPoints(name, baseElo) {
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
      const r = rng(100 + idx * 17);
      const variance = (r() * 0.3) - 0.15;
      pts[k] = Math.min(3100, Math.max(300, Math.round((baseElo * (1 + variance)) / 10) * 10));
    });
    return pts;
  }

  try {
    const res = await fetch(`${pteroUrl}/api/client/servers/${pteroServerId}/files/contents?file=plugins/StrikePractice/top_stats_cache.json`, {
      headers: { "Authorization": `Bearer ${pteroKey}`, "Accept": "application/json" }
    });

    if (res.ok) {
      const data = await res.json();
      const kills = Math.round(data.kills?.[nameParam] || 0);
      const deaths = Math.round(data.deaths?.[nameParam] || 0);
      let elo = Math.round(data.global_elo?.[nameParam] || 1000);
      if (elo === 1000 && kills > 0) {
        elo = Math.min(2850, 1000 + Math.floor(kills * 3.5) - Math.floor(deaths * 1.5));
      }

      const wins = Math.round(data.party_vs_party_wins?.[nameParam] || Math.max(0, Math.floor(kills * 0.7)));
      const losses = Math.max(0, Math.floor(deaths * 0.7));
      const total = wins + losses;
      const winRate = total > 0 ? parseFloat(((wins / total) * 100).toFixed(1)) : 0;
      const kd = deaths > 0 ? parseFloat((kills / deaths).toFixed(2)) : kills;

      const pts = computeKitPoints(nameParam, elo);

      const profile = {
        uuid: generateUuid(nameParam),
        name: nameParam,
        elo,
        tier: getRankTier(elo),
        pts,
        wins,
        losses,
        winStreak: Math.max(1, Math.floor(kills / 15)),
        bestWinStreak: Math.max(2, Math.floor(kills / 8)),
        kills,
        deaths,
        winRate,
        kd,
        kitRatings: [
          { kit: 'nethpot', elo: pts.nethpot || elo, wins: Math.floor(wins * 0.45) },
          { kit: 'spearmace', elo: pts.spearmace || elo, wins: Math.floor(wins * 0.35) },
          { kit: 'crystal', elo: pts.crystal || elo, wins: Math.floor(wins * 0.2) },
        ]
      };

      return new Response(JSON.stringify(profile), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=15"
        }
      });
    }
  } catch (e) {}

  return new Response(JSON.stringify({ error: "Player not found" }), { status: 404 });
}
