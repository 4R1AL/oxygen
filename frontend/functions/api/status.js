// Cloudflare Pages Function: /api/status - Live Minecraft Nepal Status
export async function onRequest(context) {
  let online = false;
  let onlinePlayers = 0;
  let maxPlayers = 2083;
  let motd = "✦ MINECRAFT NEPAL ✦ Now Live! • Survival • PvP • Lifesteal";

  // Try 1: mcapi.us (Fast, highly reliable from Cloudflare edge)
  try {
    const res1 = await fetch("https://mcapi.us/server/status?ip=mcnp.network", {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(3000)
    });
    if (res1.ok) {
      const d1 = await res1.json();
      if (d1.online) {
        online = true;
        onlinePlayers = d1.players?.now || 0;
        maxPlayers = d1.players?.max || 2083;
      }
    }
  } catch (e) {}

  // Try 2: mcsrvstat.us fallback
  if (!online) {
    try {
      const res2 = await fetch("https://api.mcsrvstat.us/3/mcnp.network", {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(3500)
      });
      if (res2.ok) {
        const d2 = await res2.json();
        if (d2.online) {
          online = true;
          onlinePlayers = d2.players?.online || 0;
          maxPlayers = d2.players?.max || 2083;
          if (d2.motd?.clean && d2.motd.clean.length > 0) {
            motd = d2.motd.clean.join(" ").trim();
          }
        }
      }
    } catch (e) {}
  }

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
