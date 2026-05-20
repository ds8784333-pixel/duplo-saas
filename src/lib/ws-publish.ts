// Helper para o backend (route handlers) publicar eventos no WS server.
// Uso: await publish("wallet:" + userId, { balance: 100 });
const WS_PUB_URL = process.env.WS_PUB_URL || "http://localhost:3001/pub";

export async function publish(channel: string, payload: unknown) {
  try {
    await fetch(WS_PUB_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel, payload }),
      // não bloquear caso WS server esteja fora
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    /* silent — WS é best-effort */
  }
}
