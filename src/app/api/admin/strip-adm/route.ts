// Remove ADM de uma conta especifica:
//   - rebaixa role de ADMIN/RESELLER/SUBRESELLER para USER
//   - apaga o ResellerProfile (se houver)
//   - zera o resellerId (vira orfa) — combinado com a politica nova,
//     orfa nunca eh promovida automaticamente, entao o ADM fica
//     definitivamente desligado.
//
// Autenticacao: EXIGE login como super-admin (isSuperAdmin). Sem isso
// qualquer um na internet poderia rebaixar contas — RCE de privilegio.
//
// Body: { confirm: true, email: string }
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/config";

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  if (!isSuperAdmin(me)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  let body: { confirm?: boolean; email?: string } = {};
  try { body = await req.json(); } catch (_) {}
  if (body.confirm !== true || !body.email) {
    return NextResponse.json(
      { error: 'Envie { "confirm": true, "email": "..." }' },
      { status: 400 }
    );
  }

  const email = body.email.toLowerCase().trim();
  const user = await db.user.findUnique({
    where: { email },
    include: { resellerProfile: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: `Usuario ${email} nao encontrado.` },
      { status: 404 }
    );
  }

  await db.$transaction(async (tx) => {
    if (user.resellerProfile) {
      await tx.reseller.delete({ where: { userId: user.id } });
    }
    await tx.user.update({
      where: { id: user.id },
      data: { role: "USER", resellerId: null },
    });
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      previousRole: user.role,
      newRole: "USER",
      resellerId: null,
    },
  });
}
