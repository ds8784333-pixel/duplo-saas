// Endpoints de manutencao de um usuario filho:
//   PATCH  /api/users/:id  body: { active: boolean }  -> soft delete / reativar
//   DELETE /api/users/:id                              -> hard delete (cascata)
//
// Regras:
// - Precisa estar logado (cookie de sessao).
// - ADMIN remove/desativa qualquer USER.
// - Reseller normal so age sobre seus proprios filhos (resellerId === me.id).
// - Nao pode atuar sobre si mesmo (evita o admin se apagar).
// - Nao pode atuar sobre outro ADMIN.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function loadTarget(id: string) {
  return db.user.findUnique({ where: { id } });
}

function canAct(meId: string, meRole: string, target: { id: string; role: string; resellerId: string | null }) {
  if (!target) return false;
  if (target.id === meId) return false;
  if (target.role === "ADMIN") return false;
  if (meRole === "ADMIN") return true;
  return target.resellerId === meId;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const target = await loadTarget(id);
  if (!target) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  if (!canAct(me.id, me.role, target)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: { active?: boolean } = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar (envie { active })" }, { status: 400 });
  }

  await db.user.update({ where: { id }, data });
  return NextResponse.json({ success: true, action: data.active ? "reactivated" : "disabled" });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const target = await loadTarget(id);
  if (!target) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  if (!canAct(me.id, me.role, target)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Relacionamentos (subscriptions, wallet, loginLogs, deposits, withdraws,
  // commissions, resellerProfile) ja tem onDelete: Cascade no schema, entao
  // um delete simples remove tudo. Filhos do usuario (UserHierarchy) ficam
  // com resellerId=null (SetNull no schema) — eles continuam existindo.
  await db.user.delete({ where: { id } });
  return NextResponse.json({ success: true, action: "deleted" });
}
