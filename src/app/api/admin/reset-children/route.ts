// Endpoint administrativo: apaga contas filhas da revenda atual.
//
// Dois modos:
//   1) Reset total — body { confirm: true } SEM 'emails'.
//      Apaga TODAS as filhas E zera a carteira do admin (balance/totalIn/
//      totalOut/transactions/commissions).
//
//   2) Delecao pontual — body { confirm: true, emails: [...] }.
//      Apaga SO as filhas listadas. NAO toca na carteira do admin.
//      (Util pra remover testes sem perder o saldo/historico real.)
//
// IMPORTANTE: destrutivo. Sempre exige confirm: true.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Nenhum admin identificado" }, { status: 401 });

  let body: { confirm?: boolean; emails?: string[] } = {};
  try { body = await req.json(); } catch (_) { /* permite body vazio */ }
  if (body?.confirm !== true) {
    return NextResponse.json({ error: 'Envie { "confirm": true } para confirmar.' }, { status: 400 });
  }

  const isTargeted = Array.isArray(body.emails) && body.emails.length > 0;

  // Lista de filhas: ou todas, ou as do filtro de emails.
  const childWhere: { resellerId: string; email?: { in: string[] } } = { resellerId: me.id };
  if (isTargeted) {
    childWhere.email = { in: body.emails!.map((e) => String(e).toLowerCase().trim()) };
  }

  const children = await db.user.findMany({
    where: childWhere,
    select: { id: true, email: true },
  });

  const result = await db.$transaction(async (tx) => {
    let deletedChildren = 0;
    if (children.length > 0) {
      // Cascade no schema cuida de Subscription, Wallet, WalletTransaction
      // e Commission das filhas — basta deletar o User.
      const del = await tx.user.deleteMany({ where: { id: { in: children.map((c) => c.id) } } });
      deletedChildren = del.count;
    }

    let txsDeleted = 0;
    let commsDeleted = 0;
    // So zera a carteira do admin no modo "reset total" (sem filtro de emails).
    // Delecao pontual preserva saldo/historico do admin.
    if (!isTargeted) {
      const wallet = await tx.wallet.findUnique({ where: { userId: me.id } });
      if (wallet) {
        const t = await tx.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
        txsDeleted = t.count;
        await tx.wallet.update({
          where: { userId: me.id },
          data: { balance: 0, totalIn: 0, totalOut: 0 },
        });
      }
      const c = await tx.commission.deleteMany({ where: { earnerId: me.id } });
      commsDeleted = c.count;
    }

    return { deletedChildren, walletTransactionsDeleted: txsDeleted, commissionsDeleted: commsDeleted };
  });

  return NextResponse.json({
    ok: true,
    mode: isTargeted ? "targeted" : "reset-all",
    adminId: me.id,
    adminEmail: me.email,
    ...result,
    childrenEmails: children.map((c) => c.email),
  });
}
