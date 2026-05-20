// Endpoint JSON pro Dashboard puxar via fetch (alternativa ao render server-side).
// O dashboard atual já lê direto do DB no Server Component; este endpoint é útil
// pra reload via WebSocket sem re-renderizar a página inteira.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const now = new Date();
  const week = new Date(Date.now() + 7 * 86400_000);

  const [active, expiring, wallet, commPending] = await Promise.all([
    db.subscription.count({ where: { status: "ACTIVE", expiresAt: { gt: now } } }),
    db.subscription.count({ where: { status: "ACTIVE", expiresAt: { gt: now, lte: week } } }),
    db.wallet.findUnique({ where: { userId: me.id } }),
    db.commission.aggregate({ where: { earnerId: me.id, paid: false }, _sum: { amount: true } }),
  ]);

  return NextResponse.json({
    active,
    expiring,
    balance: Number(wallet?.balance || 0),
    totalIn: Number(wallet?.totalIn || 0),
    totalOut: Number(wallet?.totalOut || 0),
    commPending: Number(commPending._sum.amount || 0),
  });
}
