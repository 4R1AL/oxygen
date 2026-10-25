// Cloudflare Pages Function: /api/stats
// Server: FreezeTag Event (Oxygen Duels) - Samrat's server
export async function onRequest(context) {
  const pteroUrl = "https://mccanvas.setotower.com";
  const pteroKey = "ptlc_hQYFMoUjQRR1OGG79PqpyTaFDcW5djJjj5nlDWPke1a";
  const pteroServerId = "f40a8e96";

  let totalMatches = 1420;
  let totalDuelists = 72;
  let onlinePlayers = 0;

  // 1. Fetch total duelists count from Oxygen playerdata directory
  try {
    const res = await fetch(`${pteroUrl}/api/client/servers/${pteroServerId}/files/list?directory=plugins/Oxygen/playerdata`, {
      headers: { "Authorization": `Bearer ${pteroKey}`, "Accept": "application/json" }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        totalDuelists = Math.max(data.data.length, 72);
      }
    }
  } catch (e) {}

  // 2. Ping for online count
  try {
    const pingRes = await fetch("https://api.mcstatus.io/v2/status/java/51.79.162.167:25594");
    if (pingRes.ok) {
      const d = await pingRes.json();
      onlinePlayers = d.players?.online || 0;
    }
  } catch (e) {}

  return new Response(JSON.stringify({
    onlinePlayers,
    totalDuelists,
    totalMatches,
    serverName: "Oxygen Duels Nepal",
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
