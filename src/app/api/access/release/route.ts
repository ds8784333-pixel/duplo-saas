// Libera (ou renova) acesso de um cliente. Se o e-mail não existir, cria o user
// vinculado ao reseller logado. Cria/atualiza Subscription e debita preço (placeholder).
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
  const days = body.data.trial ? 1 : body.data.days;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // upsert user
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

  if (existing) {
    await db.subscription.update({ where: { id: existing.id }, data: { expiresAt: newExpiry } });
  } else {
    await db.subscription.create({
      data: {
        userId: user.id, planId: plan.id, status: "ACTIVE",
        expiresAt: newExpiry, createdBy: me.id, isTrial: body.data.trial,
      },
    });
  }

  // débito placeholder na carteira do reseller (preço por dia × dias)
  const price = Number(plan.pricePerDay) * days;
  const wallet = await db.wallet.upsert({ where: { userId: me.id }, create: { userId: me.id }, update: {} });
  if (price > 0 && !body.data.trial) {
    const balanceAfter = Number(wallet.balance) - price;
    await db.$transaction([
      db.wallet.update({ where: { userId: me.id }, data: { balance: balanceAfter, totalOut: { increment: price } } }),
      db.walletTransaction.create({
        data: {
          walletId: wallet.id, type: "RELEASE", amount: -price, balanceAfter,
          description: `Liberação ${days} dia(s) para ${email}`,
        },
      }),
    ]);
    await publish("wallet:" + me.id, { type: "wallet.updated", message: "Acesso liberado" });
  }

  return NextResponse.json({ ok: true, userId: user.id, expiresAt: newExpiry });
}
