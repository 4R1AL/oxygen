// Cloudflare Pages Function: /api/status
// Server: FreezeTag Event (Oxygen Duels) - Samrat's server
export async function onRequest(context) {
  const host = "51.79.162.167";
  const port = "25594";
  const pteroUrl = "https://mccanvas.setotower.com";
  const pteroKey = "ptlc_hQYFMoUjQRR1OGG79PqpyTaFDcW5djJjj5nlDWPke1a";
  const pteroServerId = "f40a8e96";

  let online = false;
  let onlinePlayers = 0;
  let maxPlayers = 100;
  let motd = "Oxygen Duels Nepal Network";

  // 1. Direct Pterodactyl container state check on FreezeTag Event (f40a8e96)
  try {
    const pteroRes = await fetch(`${pteroUrl}/api/client/servers/${pteroServerId}/resources`, {
      headers: { "Authorization": `Bearer ${pteroKey}`, "Accept": "application/json" }
    });
    if (pteroRes.ok) {
      const pteroData = await pteroRes.json();
      if (pteroData.attributes?.current_state === "running") {
        online = true;
      }
    }
  } catch (e) {}

  // 2. Query mcstatus.io for player count and motd
  try {
    const res = await fetch(`https://api.mcstatus.io/v2/status/java/${host}:${port}`, {
      headers: { "Accept": "application/json" }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.online) online = true;
      onlinePlayers = data.players?.online || 0;
      maxPlayers = data.players?.max || 100;
      if (data.motd?.clean) motd = data.motd.clean;
    }
  } catch (e) {}

  return new Response(JSON.stringify({
    status: online ? "online" : "offline",
    serverName: "Oxygen Duels Nepal",
    serverIp: "play.samratnagarkoti.com.np",
    version: "1.21.4",
    onlinePlayers,
    maxPlayers,
    motd,
    ping: 25,
    timestamp: Date.now()
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=10"
    }
  });
}
