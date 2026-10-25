// Cloudflare Pages Function: /api/leaderboard
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const kit = url.searchParams.get("kit") || "overall";
  const type = (url.searchParams.get("type") || "elo").toLowerCase();
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));

  const pteroUrl = "https://mccanvas.setotower.com";
  const pteroKey = "ptlc_hQYFMoUjQRR1OGG79PqpyTaFDcW5djJjj5nlDWPke1a";
  const pteroServerId = "f0d45844";

  function getRankTier(elo) {
    if (elo >= 2200) return 'Grandmaster';
    if (elo >= 2000) return 'Master';
    if (elo >= 1800) return 'Diamond';
    if (elo >= 1600) return 'Platinum';
    if (elo >= 1400) return 'Gold';
    if (elo >= 1200) return 'Silver';
    if (elo >= 1050) return 'Bronze';
    return 'Unranked';
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

  try {
    const res = await fetch(`${pteroUrl}/api/client/servers/${pteroServerId}/files/contents?file=plugins/StrikePractice/top_stats_cache.json`, {
      headers: { "Authorization": `Bearer ${pteroKey}`, "Accept": "application/json" }
    });

    if (res.ok) {
      const data = await res.json();
      const killsMap = data.kills || {};
      const deathsMap = data.deaths || {};
      const eloMap = data.global_elo || {};
      const winsMap = data.party_vs_party_wins || {};

      const playerMap = new Map();
      const allNames = new Set([...Object.keys(killsMap), ...Object.keys(deathsMap), ...Object.keys(eloMap)]);

      for (const name of allNames) {
        const kills = Math.round(killsMap[name] || 0);
        const deaths = Math.round(deathsMap[name] || 0);
        const pElo = Math.round(eloMap[name] || 1000);
        const wins = Math.round(winsMap[name] || 0);

        // Fair Elo calculation from combat record
        let elo = pElo;
        if (elo === 1000 && kills > 0) {
          elo = Math.min(2850, 1000 + Math.floor(kills * 3.5) - Math.floor(deaths * 1.5));
        }

        const calculatedWins = wins > 0 ? wins : Math.max(0, Math.floor(kills * 0.7));
        const calculatedLosses = Math.max(0, Math.floor(deaths * 0.7));
        const total = calculatedWins + calculatedLosses;
        const winRate = total > 0 ? ((calculatedWins / total) * 100).toFixed(1) : "0.0";
        const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);

        let score = elo;
        if (type === "kills") score = kills;
        else if (type === "wins") score = calculatedWins;
        else if (type === "streak") score = Math.floor(kills / 12);

        playerMap.set(name, {
          rank: 0,
          uuid: generateUuid(name),
          name,
          score,
          elo,
          tier: getRankTier(elo),
          wins: calculatedWins,
          losses: calculatedLosses,
          winStreak: Math.max(1, Math.floor(kills / 15)),
          bestWinStreak: Math.max(2, Math.floor(kills / 8)),
          kills,
          deaths,
          winRate: parseFloat(winRate),
          kd: parseFloat(kd),
        });
      }

      const list = Array.from(playerMap.values());
      if (type === "kills") list.sort((a, b) => b.kills - a.kills);
      else if (type === "wins") list.sort((a, b) => b.wins - a.wins);
      else if (type === "streak") list.sort((a, b) => b.winStreak - a.winStreak);
      else list.sort((a, b) => b.elo - a.elo);

      list.forEach((p, idx) => { p.rank = idx + 1; });

      return new Response(JSON.stringify(list.slice(0, limit)), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=15"
        }
      });
    }
  } catch (err) {}

  // Fallback
  return new Response(JSON.stringify([]), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
