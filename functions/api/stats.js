// Cloudflare Pages Function: /api/stats
export async function onRequest(context) {
  return new Response(JSON.stringify({
    serverIp: "mcnp.network",
    totalDuelists: 72,
    rankedDuelists: 7,
    kitsCount: 21,
    status: "online"
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
