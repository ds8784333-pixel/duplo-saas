// Rebaixa uma conta de RESELLER/ADMIN para USER (conta filha) e a vincula
// a uma revenda mae existente. Apaga o ResellerProfile do user rebaixado.
//
// Body: { confirm: true, email: string, parentEmail?: string, parentSlug?: string }
// Pelo menos um entre parentEmail e parentSlug deve ser informado.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  let body: { confirm?: boolean; email?: string; parentEmail?: string; parentSlug?: string } = {};
  try { body = await req.json(); } catch (_) {}
  if (body.confirm !== true || !body.email) {
    return NextResponse.json({ error: 'Envie { "confirm": true, "email": "...", "parentEmail|parentSlug": "..." }' }, { status: 400 });
  }

  const email = body.email.toLowerCase().trim();
  const user = await db.user.findUnique({
    where: { email },
    include: { resellerProfile: true },
  });
  if (!user) {
    return NextResponse.json({ error: `Usuario com email ${email} nao encontrado.` }, { status: 404 });
  }

  // Encontra a revenda mae.
  let parent = null;
  if (body.parentEmail) {
    parent = await db.user.findUnique({ where: { email: body.parentEmail.toLowerCase().trim() } });
  } else if (body.parentSlug) {
    const reseller = await db.reseller.findUnique({
      where: { brandSlug: body.parentSlug.toLowerCase().trim() },
      include: { user: true },
    });
    parent = reseller?.user || null;
  } else {
    return NextResponse.json({ error: "Informe parentEmail ou parentSlug." }, { status: 400 });
  }
  if (!parent) {
    return NextResponse.json({ error: "Revenda mae nao encontrada." }, { status: 404 });
  }
  if (parent.role !== "ADMIN" && parent.role !== "RESELLER") {
    return NextResponse.json({ error: "A conta indicada como mae nao e revenda (role nao e ADMIN/RESELLER)." }, { status: 400 });
  }
  if (parent.id === user.id) {
    return NextResponse.json({ error: "Voce nao pode ser mae dela mesma." }, { status: 400 });
  }

  // Atualiza role + vincula a mae + apaga ResellerProfile (se houver).
  await db.$transaction(async (tx) => {
    if (user.resellerProfile) {
      await tx.reseller.delete({ where: { userId: user.id } });
    }
    await tx.user.update({
      where: { id: user.id },
      data: { role: "USER", resellerId: parent.id },
    });
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, newRole: "USER" },
    parent: { id: parent.id, email: parent.email, name: parent.name },
  });
}
