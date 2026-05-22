// Endpoint administrativo: apaga TODAS as contas filhas da revenda atual
// e zera a carteira do admin (saldo, totalIn, totalOut, transactions e
// commissions). Usado pra reset/limpeza durante setup ou testes.
//
// IMPORTANTE: destrutivo. Roda apenas em POST, requer body com confirm:true.
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

  // Lista de filhas: ou todas, ou as do filtro de emails.
  const childWhere: { resellerId: string; email?: { in: string[] } } = { resellerId: me.id };
  if (Array.isArray(body.emails) && body.emails.length > 0) {
    childWhere.email = { in: body.emails.map((e) => String(e).toLowerCase().trim()) };
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

    // Zera a carteira do admin (balance, totalIn, totalOut).
    const wallet = await tx.wallet.findUnique({ where: { userId: me.id } });
    let txsDeleted = 0;
    if (wallet) {
      const t = await tx.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
      txsDeleted = t.count;
      await tx.wallet.update({
        where: { userId: me.id },
        data: { balance: 0, totalIn: 0, totalOut: 0 },
      });
    }

    // Apaga commissions do admin (earner = me) — historico zera.
    const commsDeleted = await tx.commission.deleteMany({ where: { earnerId: me.id } });

    return { deletedChildren, walletTransactionsDeleted: txsDeleted, commissionsDeleted: commsDeleted.count };
  });

  return NextResponse.json({
    ok: true,
    adminId: me.id,
    adminEmail: me.email,
    ...result,
    childrenEmails: children.map((c) => c.email),
  });
}
