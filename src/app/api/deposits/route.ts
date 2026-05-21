import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createPixPayment } from "@/lib/mercadopago";

const schema = z.object({
  amount: z.number().positive().min(1, "Valor mínimo R$ 1,00").max(50000),
});

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dados inválidos" }, { status: 400 });
  }
  const amount = Math.round(parsed.data.amount * 100) / 100;

  const deposit = await db.deposit.create({
    data: { userId: me.id, amount, status: "PENDING" },
  });

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const notificationUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/api/webhooks/payment` : undefined;

  try {
    // MP recusa emails com TLD não público (.local, .test, .invalid).
    // Usa o email do usuário se for válido, senão um fallback genérico.
    const validTld = /\.(com|com\.br|net|org|io|app|co|me|dev|tech|ai|info|biz|gov\.br|edu\.br)$/i;
    const payerEmail = validTld.test(me.email)
      ? me.email
      : (process.env.MP_FALLBACK_PAYER_EMAIL || "cliente@duplosaas.com.br");

    const pix = await createPixPayment({
      amount,
      description: `Depósito carteira · ${me.name}`,
      payerEmail,
      payerName: me.name,
      externalReference: deposit.id,
      notificationUrl,
    });

    const updated = await db.deposit.update({
      where: { id: deposit.id },
      data: {
        providerId: String(pix.id),
        qrCodeBase64: pix.qrCodeBase64,
        copiaECola: pix.copiaECola,
        ticketUrl: pix.ticketUrl,
        expiresAt: pix.expiresAt ? new Date(pix.expiresAt) : null,
      },
    });

    return NextResponse.json({
      id: updated.id,
      amount: updated.amount,
      qrCodeBase64: updated.qrCodeBase64,
      copiaECola: updated.copiaECola,
      ticketUrl: updated.ticketUrl,
      expiresAt: updated.expiresAt,
      status: updated.status,
    });
  } catch (e: unknown) {
    await db.deposit.update({ where: { id: deposit.id }, data: { status: "REJECTED" } });
    const message = e instanceof Error ? e.message : "Falha ao gerar Pix";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
