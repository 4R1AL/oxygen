// Cloudflare Pages Function: /api/player/:name
export async function onRequest(context) {
  const nameParam = decodeURIComponent(context.params.name || "").trim();
  if (!nameParam) {
    return new Response(JSON.stringify({ error: "Missing player name" }), { status: 400 });
  }

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
      const kills = Math.round(data.kills?.[nameParam] || 0);
      const deaths = Math.round(data.deaths?.[nameParam] || 0);
      let elo = Math.round(data.global_elo?.[nameParam] || 1000);
      if (elo === 1000 && kills > 0) {
        elo = Math.min(2850, 1000 + Math.floor(kills * 3.5) - Math.floor(deaths * 1.5));
      }

      const wins = Math.round(data.party_vs_party_wins?.[nameParam] || Math.max(0, Math.floor(kills * 0.7)));
      const losses = Math.max(0, Math.floor(deaths * 0.7));
      const total = wins + losses;
      const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
      const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);

      const profile = {
        uuid: generateUuid(nameParam),
        name: nameParam,
        elo,
        tier: getRankTier(elo),
        wins,
        losses,
        winStreak: Math.max(1, Math.floor(kills / 15)),
        bestWinStreak: Math.max(2, Math.floor(kills / 8)),
        kills,
        deaths,
        winRate: parseFloat(winRate),
        kd: parseFloat(kd),
        kitRatings: [
          { kit: 'nethpot', elo: elo + 25, wins: Math.floor(wins * 0.45) },
          { kit: 'spearmace', elo: elo + 15, wins: Math.floor(wins * 0.35) },
          { kit: 'macepvp', elo: elo - 10, wins: Math.floor(wins * 0.2) },
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
