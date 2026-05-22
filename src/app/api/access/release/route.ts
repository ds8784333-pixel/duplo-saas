// Libera (ou renova) acesso de um cliente. Se o e-mail não existir, cria o user
// vinculado ao reseller logado. Cria/atualiza Subscription e debita o preco
// (dias × pricePerDay) da carteira do reseller. Bloqueia se saldo insuficiente.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { publish } from "@/lib/ws-publish";

const schema = z.object({
  email: z.string().email(),
  days: z.number().int().min(1).max(365).default(30),
  trial: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const plan = await db.plan.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
  if (!plan) return NextResponse.json({ error: "Nenhum plano ativo" }, { status: 400 });

  const email = body.data.email.toLowerCase();
  const isTrial = body.data.trial;
  const days = isTrial ? 1 : body.data.days;
  const pricePerDay = Number(plan.pricePerDay);
  const price = isTrial ? 0 : pricePerDay * days;

  // Bloqueia liberacao paga se a carteira do reseller nao tem saldo suficiente.
  // Trial (24h gratis) continua liberado mesmo com saldo zerado.
  const wallet = await db.wallet.upsert({
    where: { userId: me.id },
    create: { userId: me.id },
    update: {},
  });
  const currentBalance = Number(wallet.balance);
  if (!isTrial && currentBalance < price) {
    return NextResponse.json(
      {
        error: "Saldo insuficiente na carteira da revenda.",
        balance: currentBalance,
        price,
        missing: Number((price - currentBalance).toFixed(2)),
        pricePerDay,
        days,
      },
      { status: 402 } // Payment Required
    );
  }

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // upsert user (cria como conta filha vinculada ao reseller atual).
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: email.split("@")[0],
        passwordHash: hashPassword(Math.random().toString(36).slice(2, 10)),
        role: "USER",
        resellerId: me.id,
        wallet: { create: {} },
      },
    });
  }

  // upsert subscription
  const existing = await db.subscription.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    orderBy: { expiresAt: "desc" },
  });

  const newExpiry = existing
    ? new Date(Math.max(existing.expiresAt.getTime(), Date.now()) + days * 24 * 60 * 60 * 1000)
    : expiresAt;

  // Atualiza/cria subscription + debita carteira numa unica transacao.
  await db.$transaction(async (tx) => {
    if (existing) {
      await tx.subscription.update({ where: { id: existing.id }, data: { expiresAt: newExpiry } });
    } else {
      await tx.subscription.create({
        data: {
          userId: user.id, planId: plan.id, status: "ACTIVE",
          expiresAt: newExpiry, createdBy: me.id, isTrial,
        },
      });
    }
    if (price > 0) {
      const balanceAfter = currentBalance - price;
      await tx.wallet.update({
        where: { userId: me.id },
        data: { balance: balanceAfter, totalOut: { increment: price } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id, type: "RELEASE", amount: -price, balanceAfter,
          description: `Liberação ${days} dia(s) para ${email}`,
        },
      });
    }
  });

  if (price > 0) {
    await publish("wallet:" + me.id, { type: "wallet.updated", message: "Acesso liberado" });
  }

  return NextResponse.json({ ok: true, userId: user.id, expiresAt: newExpiry, debited: price });
}
