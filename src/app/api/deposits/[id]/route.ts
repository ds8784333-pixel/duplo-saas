import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getPayment } from "@/lib/mercadopago";
import { creditDepositIfApproved } from "@/lib/wallet-credit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const dep = await db.deposit.findUnique({ where: { id } });
  if (!dep || dep.userId !== me.id) {
    return NextResponse.json({ error: "Depósito não encontrado" }, { status: 404 });
  }

  // Se ainda pendente, consulta o MP — fallback caso o webhook não tenha chegado.
  if (dep.status === "PENDING" && dep.providerId) {
    try {
      const payment = await getPayment(dep.providerId);
      if (payment?.status) {
        await creditDepositIfApproved(dep.id, payment.status);
      }
    } catch {
      // ignora erro de poll — front continua tentando
    }
  }

  const fresh = await db.deposit.findUnique({ where: { id } });
  return NextResponse.json({
    id: fresh!.id,
    status: fresh!.status,
    amount: fresh!.amount,
    creditedAt: fresh!.creditedAt,
  });
}
