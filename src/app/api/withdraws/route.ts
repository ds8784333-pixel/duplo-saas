import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { publish } from "@/lib/ws-publish";

const schema = z.object({
  amount: z.number().positive(),
  pixKeyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"]),
  pixKey: z.string().min(3),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const wallet = await db.wallet.findUnique({ where: { userId: me.id } });
  if (!wallet) return NextResponse.json({ error: "Carteira não encontrada" }, { status: 404 });

  const amount = body.data.amount;
  if (Number(wallet.balance) < amount) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  // transação: cria withdraw + transaction + debita wallet
  const wd = await db.$transaction(async (tx) => {
    const newBalance = Number(wallet.balance) - amount;
    const w = await tx.withdraw.create({
      data: {
        userId: me.id,
        amount,
        pixKeyType: body.data.pixKeyType,
        pixKey: body.data.pixKey,
        note: body.data.note,
        status: "PENDING",
      },
    });
    await tx.wallet.update({
      where: { userId: me.id },
      data: { balance: newBalance, totalOut: { increment: amount } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "WITHDRAW",
        amount: -amount,
        balanceAfter: newBalance,
        description: `Saque solicitado · PIX ${body.data.pixKeyType}`,
        refId: w.id,
      },
    });
    return w;
  });

  await publish("wallet:" + me.id, { type: "wallet.updated", message: "Saque solicitado" });
  return NextResponse.json({ ok: true, withdraw: { id: wd.id, status: wd.status } });
}
