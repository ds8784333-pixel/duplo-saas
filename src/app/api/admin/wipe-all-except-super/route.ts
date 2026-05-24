// Endpoint administrativo: apaga TODOS os Users do Postgres, EXCETO o
// super-admin (definido por SUPER_ADMIN_EMAIL em config.ts).
//
// Body: { confirm: true }
//
// Deleta em cascata: Wallet, Reseller, Subscription, WalletTransaction,
// Commission, LoginLog, Withdraw, Deposit (vide schema.prisma — todas as
// relacoes do User tem onDelete: Cascade ou SetNull).
//
// Acesso: middleware ja garante que /api/admin/* exige sessao nao-USER.
// Aqui exige tambem que seja o SUPER admin (nao um RESELLER qualquer).
//
// IMPORTANTE: destrutivo e irreversivel. Sem confirm = 400.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/config";

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  if (!isSuperAdmin(me)) {
    return NextResponse.json({ error: "Apenas o super-admin pode executar." }, { status: 403 });
  }

  let body: { confirm?: boolean } = {};
  try { body = await req.json(); } catch (_) { /* permite body vazio */ }
  if (body?.confirm !== true) {
    return NextResponse.json({ error: 'Envie { "confirm": true } para confirmar.' }, { status: 400 });
  }

  // Conta antes pra reportar.
  const totalBefore = await db.user.count();

  // Deleta tudo que NAO eh o super-admin. Cascade do schema cuida do resto.
  const del = await db.user.deleteMany({ where: { id: { not: me.id } } });

  // Zera a carteira do super-admin (saldo, totalIn, totalOut) e historico.
  let txsDeleted = 0;
  const wallet = await db.wallet.findUnique({ where: { userId: me.id } });
  if (wallet) {
    const t = await db.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
    txsDeleted = t.count;
    await db.wallet.update({
      where: { userId: me.id },
      data: { balance: 0, totalIn: 0, totalOut: 0, pendingBalance: 0 },
    });
  }

  return NextResponse.json({
    ok: true,
    superAdminPreserved: { id: me.id, email: me.email },
    usersDeleted: del.count,
    totalBefore,
    superAdminWalletReset: !!wallet,
    walletTransactionsDeleted: txsDeleted,
  });
}
