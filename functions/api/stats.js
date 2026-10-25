// Cloudflare Pages Function: /api/stats
export async function onRequest(context) {
  const pteroUrl = "https://mccanvas.setotower.com";
  const pteroKey = "ptlc_hQYFMoUjQRR1OGG79PqpyTaFDcW5djJjj5nlDWPke1a";
  const pteroServerId = "f0d45844";

  let totalMatches = 8520;
  let totalDuelists = 48;
  let onlinePlayers = 0;

  // 1. Fetch live total fights
  try {
    const res = await fetch(`${pteroUrl}/api/client/servers/${pteroServerId}/files/contents?file=plugins/StrikePractice/fights.yml`, {
      headers: { "Authorization": `Bearer ${pteroKey}`, "Accept": "application/json" }
    });
    if (res.ok) {
      const text = await res.text();
      let sum = 0;
      for (const line of text.split('\n')) {
        const parts = line.split(':');
        if (parts.length === 2) {
          const val = parseInt(parts[1].trim(), 10);
          if (!isNaN(val)) sum += val;
        }
      }
      if (sum > 0) totalMatches = sum;
    }
  } catch (e) {}

  // 2. Fetch total duelists count from top_stats_cache.json
  try {
    const res = await fetch(`${pteroUrl}/api/client/servers/${pteroServerId}/files/contents?file=plugins/StrikePractice/top_stats_cache.json`, {
      headers: { "Authorization": `Bearer ${pteroKey}`, "Accept": "application/json" }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.kills) totalDuelists = Math.max(Object.keys(data.kills).length, 48);
    }
  } catch (e) {}

  // 3. Ping for online count
  try {
    const pingRes = await fetch("https://api.mcstatus.io/v2/status/java/51.79.162.167:25590");
    if (pingRes.ok) {
      const d = await pingRes.json();
      onlinePlayers = d.players?.online || 0;
    }
  } catch (e) {}

  return new Response(JSON.stringify({
    onlinePlayers,
    totalDuelists,
    totalMatches,
    serverName: "Oxygen PvP Nepal",
    serverIp: "play.samratnagarkoti.com.np",
    version: "1.21.4"
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=15"
    }
  });
}
