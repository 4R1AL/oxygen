// Cloudflare Pages Function: /api/status
export async function onRequest(context) {
  const host = "51.79.162.167";
  const port = "25590";

  let online = false;
  let onlinePlayers = 0;
  let maxPlayers = 100;
  let motd = "Oxygen / StrikePractice Nepal Network";

  try {
    const res = await fetch(`https://api.mcstatus.io/v2/status/java/${host}:${port}`, {
      headers: { "Accept": "application/json" }
    });
    if (res.ok) {
      const data = await res.json();
      online = Boolean(data.online);
      onlinePlayers = data.players?.online || 0;
      maxPlayers = data.players?.max || 100;
      if (data.motd?.clean) motd = data.motd.clean;
    }
  } catch (e) {}

  return new Response(JSON.stringify({
    status: online ? "online" : "offline",
    serverName: "Oxygen PvP Nepal",
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
