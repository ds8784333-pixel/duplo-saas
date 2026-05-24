// Webhook Mercado Pago para pagamentos do Duplo Pro (orphan paywall).
// Diferente de /api/webhooks/payment (que credita carteira de revenda),
// aqui o pagamento NAO e deposito — e o usuario pagando direto sua propria
// assinatura mensal do scanner. Recebemos a notificacao do MP, confirmamos
// o status real via API e criamos/extendemos a Subscription do usuario.
//
// External references emitidos pelo Duplo Pro:
//   - dp-<timestamp>[-<email>]            -> Pix avulso ou Cartao 1x (Checkout Pro)
//   - dp-sub-<timestamp>-<email>          -> Assinatura recorrente (preapproval)
//
// Idempotencia: cada subscription criada por aqui guarda o ID do pagamento
// no campo createdBy como "mp:<id>". Webhook duplicado vira no-op.
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getPayment, getPreapproval } from "@/lib/mercadopago";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

const SUB_DAYS = Number(process.env.DP_SUB_DAYS) || 30;

// MP envia x-signature: "ts=...,v1=...". Mesma logica do /webhooks/payment.
function verifySignature(req: NextRequest, id: string | null): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // dev sem secret = permite
  const sig = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const ts = /ts=([^,]+)/.exec(sig)?.[1];
  const v1 = /v1=([a-f0-9]+)/i.exec(sig)?.[1];
  if (!ts || !v1 || !id) return false;
  const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
  const calc = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(calc, "hex"));
  } catch {
    return false;
  }
}

// Extrai email do external_reference. Formatos suportados:
//   "dp-<ts>-<email>"        (Pix avulso / Cartao 1x novo)
//   "dp-sub-<ts>-<email>"    (preapproval)
// Retorna null se nao encontrar.
function emailFromRef(ref: string): string | null {
  if (!ref) return null;
  const parts = ref.split("-");
  // dp-<ts>-<email...>  -> parts[0]='dp', parts[1]=ts, parts[2..]=email
  // dp-sub-<ts>-<email...> -> parts[0]='dp', parts[1]='sub', parts[2]=ts, parts[3..]=email
  const startIdx = parts[1] === "sub" ? 3 : 2;
  const candidate = parts.slice(startIdx).join("-");
  if (candidate && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidate)) return candidate.toLowerCase();
  return null;
}

async function grantAccess(email: string, paymentId: string) {
  // Idempotencia: se ja existe sub criada por esse paymentId, no-op.
  const marker = `mp:${paymentId}`;
  const dup = await db.subscription.findFirst({
    where: { createdBy: marker },
    select: { id: true, userId: true, expiresAt: true },
  });
  if (dup) return { skipped: "duplicate", subscriptionId: dup.id };

  // Find or create user. Orphan = sem resellerId (paga direto pelo MP).
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: email.split("@")[0],
        passwordHash: hashPassword(crypto.randomBytes(8).toString("hex")),
        role: "USER",
      },
    });
  }

  const plan = await db.plan.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!plan) throw new Error("Nenhum plano ativo no Duplo SaaS");

  // Se ja tem sub ativa, estende a partir do expiresAt atual. Se nao,
  // comeca de agora. Sempre +SUB_DAYS dias.
  const existing = await db.subscription.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    orderBy: { expiresAt: "desc" },
  });

  const now = new Date();
  const startBase = existing && existing.expiresAt > now ? existing.expiresAt : now;
  const newExpiry = new Date(startBase.getTime() + SUB_DAYS * 24 * 60 * 60 * 1000);

  if (existing) {
    await db.subscription.update({
      where: { id: existing.id },
      data: { expiresAt: newExpiry, createdBy: marker },
    });
    return { renewed: true, userId: user.id, expiresAt: newExpiry };
  }

  const sub = await db.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      status: "ACTIVE",
      expiresAt: newExpiry,
      createdBy: marker,
      isTrial: false,
    },
  });
  return { created: true, userId: user.id, subscriptionId: sub.id, expiresAt: newExpiry };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const queryId = url.searchParams.get("data.id") || url.searchParams.get("id");
  const queryTopic = (url.searchParams.get("topic") || url.searchParams.get("type") || "").toLowerCase();

  const raw = await req.text();
  let payload: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    /* MP as vezes manda body vazio */
  }

  const id = String(payload.data?.id || queryId || "");
  const topic = (payload.type || payload.action || queryTopic || "").toLowerCase();

  if (!id) {
    return NextResponse.json({ ok: true, skipped: "no-id" }, { headers: CORS });
  }

  if (!verifySignature(req, id)) {
    return NextResponse.json({ error: "assinatura invalida" }, { status: 401, headers: CORS });
  }

  try {
    // ---- Preapproval (assinatura recorrente cartao) ----
    if (topic.includes("preapproval") || topic.includes("subscription")) {
      const preapp = await getPreapproval(id);
      const ref = String(preapp.external_reference || "");
      if (!ref.startsWith("dp-sub-")) {
        return NextResponse.json({ ok: true, skipped: "not-dp-sub", ref }, { headers: CORS });
      }
      if (preapp.status !== "authorized") {
        return NextResponse.json(
          { ok: true, skipped: "not-authorized", status: preapp.status },
          { headers: CORS }
        );
      }
      const email = (preapp.payer_email || emailFromRef(ref) || "").toLowerCase();
      if (!email) return NextResponse.json({ ok: true, skipped: "no-email" }, { headers: CORS });
      const result = await grantAccess(email, `preapp:${id}`);
      return NextResponse.json({ ok: true, kind: "preapproval", result }, { headers: CORS });
    }

    // ---- Payment one-shot (Pix avulso ou Cartao 1x) ----
    const payment = await getPayment(id);
    const ref = String(payment.external_reference || "");
    // Pagamentos de carteira de revenda usam external_reference = depositId
    // (cuid sem prefixo dp-). Esses sao tratados em /api/webhooks/payment.
    if (!ref.startsWith("dp-") || ref.startsWith("dp-sub-")) {
      return NextResponse.json({ ok: true, skipped: "not-dp", ref }, { headers: CORS });
    }
    if (payment.status !== "approved") {
      return NextResponse.json(
        { ok: true, skipped: "not-approved", status: payment.status },
        { headers: CORS }
      );
    }
    const email = (payment.payer?.email || emailFromRef(ref) || "").toLowerCase();
    if (!email) return NextResponse.json({ ok: true, skipped: "no-email" }, { headers: CORS });
    const result = await grantAccess(email, `payment:${id}`);
    return NextResponse.json({ ok: true, kind: "payment", result }, { headers: CORS });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "erro";
    console.error("[mp-webhook] error", message);
    // 2xx para o MP nao reenviar em loop quando erro nosso.
    return NextResponse.json({ ok: false, error: message }, { headers: CORS });
  }
}
