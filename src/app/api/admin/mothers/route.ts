// Lista mae (RESELLER) vinculadas ao super-admin atual.
// Resposta similar a /api/users (filhas) pra reaproveitar UI.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/config";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  if (!isSuperAdmin(me)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const mothers = await db.user.findMany({
    where: { role: "RESELLER", resellerId: me.id },
    orderBy: { createdAt: "desc" },
    include: {
      subscriptions: { where: { status: "ACTIVE" }, orderBy: { expiresAt: "desc" }, take: 1 },
      resellerProfile: { select: { brandName: true, brandSlug: true } },
    },
  });

  const rows = mothers.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    brandName: u.resellerProfile?.brandName || u.name,
    brandSlug: u.resellerProfile?.brandSlug || null,
    active: u.active,
    lastLoginAt: u.lastLoginAt,
    subscription: u.subscriptions[0] || null,
  }));

  return NextResponse.json({ mothers: rows });
}
