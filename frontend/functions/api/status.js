// Cloudflare Pages Function: /api/status - Live Minecraft Nepal Status
export async function onRequest(context) {
  let online = false;
  let onlinePlayers = 0;
  let maxPlayers = 2083;
  let motd = "✦ MINECRAFT NEPAL ✦ Now Live! • Survival • PvP • Lifesteal";

  try {
    const res = await fetch("https://api.mcsrvstat.us/3/mcnp.network", {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.online) online = true;
      onlinePlayers = data.players?.online || 0;
      maxPlayers = data.players?.max || 2083;
      if (data.motd?.clean && data.motd.clean.length > 0) {
        motd = data.motd.clean.join(" ").trim();
      }
    }
  } catch (e) {}

  return new Response(JSON.stringify({
    status: online ? "online" : "offline",
    online,
    serverName: "Minecraft Nepal",
    serverIp: "mcnp.network",
    version: "1.21.4",
    onlinePlayers,
    maxPlayers,
    motd,
    ping: 15,
    timestamp: Date.now()
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=10"
    }
  });
}
