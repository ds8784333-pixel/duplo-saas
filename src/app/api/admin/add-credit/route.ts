// Endpoint admin: adiciona saldo direto na carteira do reseller logado.
// Usado em demos/setup quando ainda nao ha integracao de pagamento real.
// Requer body { confirm: true, amount: number }.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  let body: { confirm?: boolean; amount?: number } = {};
  try { body = await req.json(); } catch (_) {}
  if (body.confirm !== true) {
    return NextResponse.json({ error: 'Envie { "confirm": true, "amount": N }' }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return NextResponse.json({ error: "Valor invalido (0 < amount <= 1000000)" }, { status: 400 });
  }

  const wallet = await db.wallet.upsert({
    where: { userId: me.id },
    create: { userId: me.id, balance: amount, totalIn: amount },
    update: { balance: { increment: amount }, totalIn: { increment: amount } },
  });
  await db.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "DEPOSIT",
      amount,
      balanceAfter: Number(wallet.balance),
      description: `Credito manual (demo) +R$ ${amount.toFixed(2)}`,
    },
  });

  return NextResponse.json({ ok: true, balanceAfter: Number(wallet.balance) });
}
