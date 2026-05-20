import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const where = me.role === "ADMIN" ? { role: "USER" as const } : { resellerId: me.id, role: "USER" as const };

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      subscriptions: { where: { status: "ACTIVE" }, orderBy: { expiresAt: "desc" }, take: 1 },
    },
  });

  const rows = users.map((u) => ({
    id: u.id, email: u.email, name: u.name, phone: u.phone,
    active: u.active, sharingFlagged: u.sharingFlagged,
    lastLoginAt: u.lastLoginAt, lastLoginIp: u.lastLoginIp,
    subscription: u.subscriptions[0] || null,
  }));

  // CSV export
  if (req.nextUrl.searchParams.get("format") === "csv") {
    const lines = [
      "id,email,nome,telefone,ativo,suspeito,ultimo_login,ip,expira",
      ...rows.map((r) => [
        r.id, r.email, r.name, r.phone || "", r.active, r.sharingFlagged,
        r.lastLoginAt?.toISOString() || "", r.lastLoginIp || "",
        r.subscription?.expiresAt?.toISOString() || "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    return new NextResponse(lines, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="usuarios.csv"' },
    });
  }

  return NextResponse.json({ users: rows });
}
