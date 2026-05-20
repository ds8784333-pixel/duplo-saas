// Servidor WebSocket independente do Next.js.
// Rode com: node server/ws.mjs
// O cliente conecta em ws://host:PORT?channel=NAME
// Outros serviços (API routes) publicam via POST /pub
//   curl -X POST http://localhost:3001/pub -d '{"channel":"wallet:USER_ID","payload":{...}}'

import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.WS_PORT || 3001);

const channels = new Map(); // channel -> Set<WebSocket>

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/pub") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { channel, payload } = JSON.parse(body);
        const subs = channels.get(channel);
        const msg = JSON.stringify(payload);
        if (subs) for (const ws of subs) if (ws.readyState === 1) ws.send(msg);
        res.writeHead(204).end();
      } catch (e) {
        res.writeHead(400).end(String(e));
      }
    });
    return;
  }
  res.writeHead(200, { "content-type": "text/plain" }).end("duplo-saas ws ok");
});

const wss = new WebSocketServer({ server });
wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://x");
  const channel = url.searchParams.get("channel") || "default";
  if (!channels.has(channel)) channels.set(channel, new Set());
  channels.get(channel).add(ws);
  ws.send(JSON.stringify({ type: "hello", channel }));
  ws.on("close", () => channels.get(channel)?.delete(ws));
});

server.listen(PORT, () => console.log(`[ws] listening on :${PORT}`));
