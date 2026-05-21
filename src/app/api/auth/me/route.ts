import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Sem login: getCurrentUser ja cai no primeiro ADMIN/RESELLER quando nao
// ha sessao (ver src/lib/auth.ts). Mantemos um fallback estatico para o
// caso de banco vazio.
export async function GET() {
  const u = await getCurrentUser().catch(() => null);
  if (!u) {
    return NextResponse.json({
      name: "Admin",
      resellerProfile: { brandName: "Admin", brandSlug: "minha-revenda", logoUrl: null, whatsapp: "" },
    });
  }
  return NextResponse.json(u);
}

// Slugs reservados — nao podem ser usados como marca por colidir com
// rotas internas do duplo-saas ou do Duplo Pro.
const RESERVED_SLUGS = new Set([
  "login", "register", "dashboard", "carteira", "usuarios",
  "subrevendas", "minha-revenda", "liberar-acesso", "api",
  "app", "r", "admin", "auth", "favicon.ico", "robots.txt",
  "sitemap.xml", "_next", "static",
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

const patchSchema = z.object({
  brandName: z.string().min(1).max(80).optional(),
  brandSlug: z.string().min(2).max(40).optional(),
  logoUrl: z.string().max(2_000_000).optional(), // data URL grande permitido
  whatsapp: z.string().max(20).optional(),
});

export async function PATCH(req: NextRequest) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return NextResponse.json({ error: "Nenhum usuario cadastrado" }, { status: 400 });

  const body = patchSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });

  // Validacao adicional do slug, se enviado.
  let nextSlug: string | undefined;
  if (body.data.brandSlug != null) {
    const s = body.data.brandSlug.toLowerCase();
    if (!SLUG_RE.test(s)) {
      return NextResponse.json({ error: "Slug invalido: use letras, numeros e hifens (2-40 chars)." }, { status: 400 });
    }
    if (RESERVED_SLUGS.has(s)) {
      return NextResponse.json({ error: "Esse slug e reservado, escolha outro." }, { status: 400 });
    }
    // Verifica colisao com outro reseller.
    const collision = await db.reseller.findUnique({ where: { brandSlug: s }, select: { userId: true } });
    if (collision && collision.userId !== u.id) {
      return NextResponse.json({ error: "Slug ja em uso por outra revenda." }, { status: 409 });
    }
    nextSlug = s;
  }

  const profile = await db.reseller.upsert({
    where: { userId: u.id },
    create: {
      userId: u.id,
      brandName: body.data.brandName || u.name,
      brandSlug: nextSlug || u.email.split("@")[0],
      logoUrl: body.data.logoUrl || null,
      whatsapp: body.data.whatsapp || null,
    },
    update: {
      brandName: body.data.brandName,
      brandSlug: nextSlug,
      logoUrl: body.data.logoUrl,
      whatsapp: body.data.whatsapp,
    },
  });

  return NextResponse.json({ ok: true, profile });
}
