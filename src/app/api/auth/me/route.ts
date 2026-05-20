import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return NextResponse.json(u);
}

const patchSchema = z.object({
  brandName: z.string().min(1).max(80).optional(),
  logoUrl: z.string().max(2_000_000).optional(), // data URL grande permitido
  whatsapp: z.string().max(20).optional(),
});

export async function PATCH(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = patchSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

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
