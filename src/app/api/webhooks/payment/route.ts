// Webhook Mercado Pago — recebe notificação de pagamento, busca status real
// na API do MP e credita carteira via creditDepositIfApproved (idempotente).
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getPayment } from "@/lib/mercadopago";
import { creditDepositIfApproved } from "@/lib/wallet-credit";

// MP envia x-signature: "ts=...,v1=...".
// Manifesto: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
function verifyMpSignature(req: NextRequest, paymentId: string | null) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // dev sem secret = permite (mas loga)
  const sig = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const ts = /ts=([^,]+)/.exec(sig)?.[1];
  const v1 = /v1=([a-f0-9]+)/i.exec(sig)?.[1];
  if (!ts || !v1 || !paymentId) return false;

  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const calc = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(calc, "hex"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // payment id pode vir em query (?data.id=) ou no body
  const url = new URL(req.url);
  const queryId = url.searchParams.get("data.id") || url.searchParams.get("id");
  const raw = await req.text();
  let payload: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { /* MP às vezes manda vazio */ }

  const paymentId = String(payload.data?.id || queryId || "");
  if (!paymentId) {
    return NextResponse.json({ ok: true, skipped: "no-payment-id" });
  }

  if (!verifyMpSignature(req, paymentId)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  const topic = payload.type || payload.action || "";
  if (topic && !topic.includes("payment")) {
    return NextResponse.json({ ok: true, skipped: "topic", topic });
  }

  try {
    const payment = await getPayment(paymentId);
    const depositId = payment.external_reference as string | undefined;
    if (!depositId) {
      return NextResponse.json({ ok: true, skipped: "no-external-reference" });
    }
    const result = await creditDepositIfApproved(depositId, payment.status);
    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "erro";
    console.error("[webhook payment] error", message);
    // devolver 200 evita reentrega em loop por erros nossos — MP usa 2xx como ack
    return NextResponse.json({ ok: false, error: message });
  }
}
