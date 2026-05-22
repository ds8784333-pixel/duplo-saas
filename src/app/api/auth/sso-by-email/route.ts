// SSO por email: o Duplo Pro chama este endpoint quando o admin clica em
// "ADM". Se o email ja tiver uma conta RESELLER/ADMIN no duplo-saas, faz
// login automaticamente; senao, cria a conta como RESELLER e tambem loga.
//
// Seguranca: aceita apenas requests com Origin/Referer do Duplo Pro
// (origem aprovada via env DUPLO_PRO_ORIGINS ou whitelist hard-coded).
// Sem essa checagem, qualquer site poderia logar como qualquer email.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, signSession, setSessionCookie } from "@/lib/auth";
import crypto from "node:crypto";

const DEFAULT_ALLOWED = [
  "https://odds-sable.vercel.app",
];

function allowedOrigins(): string[] {
  const env = (process.env.DUPLO_PRO_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return env.length ? env : DEFAULT_ALLOWED;
}

function originOf(req: NextRequest): string | null {
  const o = req.headers.get("origin");
  if (o) return o;
  const r = req.headers.get("referer");
  if (!r) return null;
  try { return new URL(r).origin; } catch { return null; }
}

function corsFor(origin: string | null) {
  const ok = origin && allowedOrigins().includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
});

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "revenda";
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsFor(originOf(req)) });
}

export async function POST(req: NextRequest) {
  const origin = originOf(req);
  const cors = corsFor(origin);
  if (!origin || !allowedOrigins().includes(origin)) {
    return NextResponse.json({ error: "Origem nao autorizada" }, { status: 403, headers: cors });
  }

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Dados invalidos (email obrigatorio)" }, { status: 400, headers: cors });
  }

  const email = body.data.email.toLowerCase().trim();
  const displayName = (body.data.name || email.split("@")[0]).trim();

  // Busca user existente.
  let user = await db.user.findUnique({
    where: { email },
    include: { wallet: true, resellerProfile: true },
  });

  // Se nao existe, cria como nova conta MAE (RESELLER) com slug derivado do email.
  if (!user) {
    let baseSlug = slugify(displayName) || slugify(email.split("@")[0]);
    let slug = baseSlug;
    let i = 1;
    while (await db.reseller.findUnique({ where: { brandSlug: slug } })) {
      slug = `${baseSlug}-${i++}`;
    }
    user = await db.user.create({
      data: {
        email,
        name: displayName,
        // Senha aleatoria (nunca usada — o login dele e via SSO do Duplo Pro).
        passwordHash: hashPassword(crypto.randomBytes(16).toString("hex")),
        role: "RESELLER",
        wallet: { create: {} },
        resellerProfile: { create: { brandName: displayName, brandSlug: slug } },
      },
      include: { wallet: true, resellerProfile: true },
    });
  } else if (user.role !== "ADMIN" && user.role !== "RESELLER") {
    // Conta filha (USER) tentou abrir o painel de admin: nega.
    return NextResponse.json(
      { error: "Este email pertence a uma conta de cliente, nao a uma revenda." },
      { status: 403, headers: cors }
    );
  }

  // Garante reseller profile (caso o user exista mas sem profile).
  if (!user.resellerProfile) {
    let baseSlug = slugify(user.name || email.split("@")[0]);
    let slug = baseSlug;
    let i = 1;
    while (await db.reseller.findUnique({ where: { brandSlug: slug } })) {
      slug = `${baseSlug}-${i++}`;
    }
    await db.reseller.create({
      data: { userId: user.id, brandName: user.name || displayName, brandSlug: slug },
    });
  }

  const token = await signSession({ sub: user.id, email: user.email, role: user.role, rid: user.resellerId });
  await setSessionCookie(token);
  return NextResponse.json(
    { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } },
    { headers: cors }
  );
}
