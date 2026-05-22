// Setup do super-admin: marca a conta SUPER_ADMIN_EMAIL como ADMIN,
// vincula TODAS as outras maes (RESELLER) a ela (resellerId = super.id)
// e remove suas Subscriptions (deixando elas em estado "pending" do
// ponto de vista do super-admin).
//
// Idempotente: rodar varias vezes nao quebra nada.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SUPER_ADMIN_EMAIL } from "@/lib/config";
import { hashPassword } from "@/lib/auth";
import crypto from "node:crypto";

export async function POST(req: NextRequest) {
  let body: { confirm?: boolean } = {};
  try { body = await req.json(); } catch (_) {}
  if (body.confirm !== true) {
    return NextResponse.json({ error: 'Envie { "confirm": true }' }, { status: 400 });
  }

  // 1) Garante que existe o usuario super-admin com role=ADMIN.
  let superUser = await db.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } });
  if (!superUser) {
    superUser = await db.user.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        name: "Super Admin",
        passwordHash: hashPassword(crypto.randomBytes(16).toString("hex")),
        role: "ADMIN",
        wallet: { create: {} },
      },
    });
  } else if (superUser.role !== "ADMIN") {
    superUser = await db.user.update({
      where: { id: superUser.id },
      data: { role: "ADMIN", resellerId: null },
    });
  }

  // 2) Encontra todas as MAES (qualquer ADMIN/RESELLER que NAO seja o super).
  const mothers = await db.user.findMany({
    where: {
      role: { in: ["ADMIN", "RESELLER"] },
      id: { not: superUser.id },
    },
    select: { id: true, email: true, role: true },
  });

  // 3) Pra cada mae: garante role=RESELLER (pra nao concorrerem com super),
  //    vincula resellerId = super, e DELETA Subscriptions ativas dela (assim
  //    fica em estado "pending" — precisa do super liberar).
  let demotedCount = 0;
  let subsRemoved = 0;
  for (const m of mothers) {
    await db.user.update({
      where: { id: m.id },
      data: { role: "RESELLER", resellerId: superUser.id },
    });
    const del = await db.subscription.deleteMany({ where: { userId: m.id } });
    subsRemoved += del.count;
    demotedCount++;
  }

  return NextResponse.json({
    ok: true,
    superAdmin: { id: superUser.id, email: superUser.email, role: superUser.role },
    mothersUpdated: demotedCount,
    subscriptionsRemoved: subsRemoved,
  });
}
