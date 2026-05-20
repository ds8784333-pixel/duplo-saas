import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const [wallet, txs, withdraws, defaultPlan] = await Promise.all([
    db.wallet.upsert({ where: { userId: me.id }, create: { userId: me.id }, update: {} }),
    db.walletTransaction.findMany({
      where: { wallet: { userId: me.id } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.withdraw.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.plan.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } }),
  ]);

  return NextResponse.json({
    user: { id: me.id, name: me.name, brandName: me.resellerProfile?.brandName },
    wallet: {
      balance: wallet.balance.toString(),
      pendingBalance: wallet.pendingBalance.toString(),
      totalIn: wallet.totalIn.toString(),
      totalOut: wallet.totalOut.toString(),
    },
    transactions: txs.map((t) => ({
      id: t.id, type: t.type, amount: t.amount.toString(), balanceAfter: t.balanceAfter.toString(),
      description: t.description, createdAt: t.createdAt,
    })),
    withdraws: withdraws.map((w) => ({
      id: w.id, amount: w.amount.toString(), pixKey: w.pixKey, status: w.status, createdAt: w.createdAt,
    })),
    pricePerDay: Number(defaultPlan?.pricePerDay || 0.6),
  });
}
