// Webhook de pagamento — Mercado Pago ou Asaas.
// STUB seguro: aceita o payload, registra como ADJUSTMENT no console, NÃO credita
// automaticamente. Quando você ligar de verdade, faça a validação HMAC, busque
// o pagamento via API do provedor, e chame creditPaymentToWallet().
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { publish } from "@/lib/ws-publish";

function verifyMpSignature(req: NextRequest, raw: string) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // dev mode
  const sig = req.headers.get("x-signature") || "";
  // formato MP: "ts=...,v1=...". Aqui valida apenas a presença em dev.
  // TODO produção: extrair ts/v1 e recalcular HMAC-SHA256(`id:<id>;request-id:<rid>;ts:<ts>;`)
  const v1 = /v1=([a-f0-9]+)/i.exec(sig)?.[1];
  if (!v1) return false;
  const calc = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(calc));
}

async function creditPaymentToWallet(userId: string, amount: number, ref: string) {
  const wallet = await db.wallet.upsert({ where: { userId }, create: { userId }, update: {} });
  const balanceAfter = Number(wallet.balance) + amount;
  await db.$transaction([
    db.wallet.update({ where: { userId }, data: { balance: balanceAfter, totalIn: { increment: amount } } }),
    db.walletTransaction.create({
      data: {
        walletId: wallet.id, type: "DEPOSIT", amount, balanceAfter,
        description: `Depósito PIX · ref ${ref}`, refId: ref,
      },
    }),
  ]);
  await publish("wallet:" + userId, { type: "wallet.updated", message: "Depósito aprovado" });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyMpSignature(req, raw)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }
  let payload: any = {};
  try { payload = JSON.parse(raw); } catch { /* MP às vezes manda form-urlencoded */ }

  // STUB: log + 200. Substitua aqui:
  // 1. extrair payment id de payload.data.id
  // 2. GET https://api.mercadopago.com/v1/payments/{id} com MP_ACCESS_TOKEN
  // 3. se status === "approved": creditPaymentToWallet(userId, amount, paymentId)
  console.log("[webhook payment] received", { topic: payload.type || payload.action, id: payload.data?.id });

  return NextResponse.json({ ok: true, mode: "stub" });
}

// Para você verificar manualmente em dev:
// curl -X POST localhost:3000/api/webhooks/payment -d '{"type":"payment","data":{"id":"123"}}'
