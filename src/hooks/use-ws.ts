"use client";
import { useEffect, useRef, useState } from "react";

export function useWS<T = unknown>(channel: string) {
  const [last, setLast] = useState<T | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
    let alive = true;
    const ws = new WebSocket(url + "?channel=" + encodeURIComponent(channel));
    wsRef.current = ws;
    ws.onmessage = (e) => { try { setLast(JSON.parse(e.data)); } catch {} };
    return () => { alive = false; try { ws.close(); } catch {} };
  }, [channel]);

  return { last, send: (m: unknown) => wsRef.current?.send(JSON.stringify(m)) };
}
