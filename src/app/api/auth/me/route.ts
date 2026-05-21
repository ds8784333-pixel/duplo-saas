import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Sem login: se houver sessao usamos ela; senao caimos no primeiro
// usuario admin/reseller cadastrado para que o painel "Minha revenda"
// funcione dentro do iframe ADM do Duplo Pro.
async function resolveUser() {
  const u = await getCurrentUser().catch(() => null);
  if (u) return u;
  return db.user.findFirst({
    where: { OR: [{ role: "ADMIN" }, { role: "RESELLER" }] },
    include: { wallet: true, resellerProfile: true },
    orderBy: { createdAt: "asc" },
  }).catch(() => null);
}

export async function GET() {
  const u = await resolveUser();
  if (!u) {
    return NextResponse.json({
      name: "Admin",
      resellerProfile: { brandName: "Admin", brandSlug: "minha-revenda", logoUrl: null, whatsapp: "" },
    });
  }
  return NextResponse.json(u);
}

const patchSchema = z.object({
  brandName: z.string().min(1).max(80).optional(),
  logoUrl: z.string().max(2_000_000).optional(), // data URL grande permitido
  whatsapp: z.string().max(20).optional(),
});

export async function PATCH(req: NextRequest) {
  const u = await resolveUser();
  if (!u) return NextResponse.json({ error: "Nenhum usuario cadastrado" }, { status: 400 });

  const body = patchSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });

  const profile = await db.reseller.upsert({
    where: { userId: u.id },
    create: {
      userId: u.id,
      brandName: body.data.brandName || u.name,
      brandSlug: u.email.split("@")[0],
      logoUrl: body.data.logoUrl || null,
      whatsapp: body.data.whatsapp || null,
    },
    update: {
      brandName: body.data.brandName,
      logoUrl: body.data.logoUrl,
      whatsapp: body.data.whatsapp,
    },
  });

  return NextResponse.json({ ok: true, profile });
}
