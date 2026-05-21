// Helper para o backend (route handlers) publicar eventos no WS server.
// Uso: await publish("wallet:" + userId, { balance: 100 });
// Em deploys sem WS (ex: Vercel serverless), basta não setar WS_PUB_URL.
export async function publish(channel: string, payload: unknown) {
  const url = process.env.WS_PUB_URL;
  if (!url) return; // no-op se WS não configurado
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel, payload }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    /* silent — WS é best-effort */
  }
}
