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
import { signSession, setSessionCookie } from "@/lib/auth";
import { isSsoOriginAllowed, DUPLO_SAAS_URL } from "@/lib/config";

function originOf(req: NextRequest): string | null {
  const o = req.headers.get("origin");
  if (o) return o;
  const r = req.headers.get("referer");
  if (!r) return null;
  try { return new URL(r).origin; } catch { return null; }
}

function corsFor(origin: string | null) {
  const ok = isSsoOriginAllowed(origin);
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
  if (!isSsoOriginAllowed(origin)) {
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

  // POLITICA ESTRITA DE ADM:
  // Somente contas cujo PARENT eh o SUPER-ADMIN (role ADMIN) tem ADM.
  // - Email novo (nao existe): NEGA. Cliente comum nao vira revenda
  //   automaticamente pelo SSO — precisa ser cadastrado via link da super.
  // - User existente sem parent (orfao): NEGA. Auto-cadastros direto no
  //   /register ou via Google Sign-In nao recebem ADM.
  // - User existente com parent que nao eh ADMIN: NEGA (conta filha de
  //   outra revenda).
  // - User existente com parent ADMIN: PROMOVE pra RESELLER se ainda nao for.
  // - ADMIN existente (a propria super): libera direto.
  // - RESELLER existente: libera somente se parent eh ADMIN (criado via link).
  if (!user) {
    return NextResponse.json(
      { error: "Conta nao encontrada. Acesse pelo link de cadastro do Duplo Pro pra ter o painel ADM." },
      { status: 403, headers: cors }
    );
  }

  if (user.role === "ADMIN") {
    // ADMIN (super): libera direto, sem mais checagens.
  } else if (user.role === "RESELLER") {
    // RESELLER existente: garante que o parent eh ADMIN (criado via link da super).
    if (!user.resellerId) {
      return NextResponse.json(
        { error: "Esta revenda nao foi cadastrada via link do Duplo Pro." },
        { status: 403, headers: cors }
      );
    }
    const parent = await db.user.findUnique({
      where: { id: user.resellerId },
      select: { role: true },
    });
    if (!parent || parent.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Esta revenda nao foi cadastrada via link do Duplo Pro." },
        { status: 403, headers: cors }
      );
    }
  } else {
    // USER comum: so promove se PARENT eh ADMIN (super-admin).
    if (!user.resellerId) {
      return NextResponse.json(
        { error: "Esta conta nao foi cadastrada via link do Duplo Pro. Apenas resellers convidadas tem ADM." },
        { status: 403, headers: cors }
      );
    }
    const parent = await db.user.findUnique({
      where: { id: user.resellerId },
      select: { role: true },
    });
    if (!parent || parent.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Esta conta nao foi cadastrada via link do Duplo Pro." },
        { status: 403, headers: cors }
      );
    }
    // Promove pra RESELLER: gera slug unico e cria reseller profile + wallet.
    let baseSlug = slugify(user.name || email.split("@")[0]);
    let slug = baseSlug;
    let i = 1;
    while (await db.reseller.findUnique({ where: { brandSlug: slug } })) {
      slug = `${baseSlug}-${i++}`;
    }
    user = await db.user.update({
      where: { id: user.id },
      data: {
        role: "RESELLER",
        ...(user.resellerProfile
          ? {}
          : { resellerProfile: { create: { brandName: user.name || displayName, brandSlug: slug } } }),
        ...(user.wallet ? {} : { wallet: { create: {} } }),
      },
      include: { wallet: true, resellerProfile: true },
    });
  }

  // Garante reseller profile (caso ADMIN/RESELLER exista mas sem profile).
  if (!user.resellerProfile && user.role !== "USER") {
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

  // Emite um token CURTO (60s) destinado ao /api/auth/sso-consume.
  // O cliente vai carregar esse endpoint no iframe.src — assim o cookie de
  // sessao e setado em contexto FIRST-PARTY do duplo-saas (bypassa o
  // bloqueio de cookies third-party do Chrome quando o cookie viria da
  // resposta deste POST cross-origin).
  const ssoToken = await signSession(
    { sub: user.id, email: user.email, role: user.role, rid: user.resellerId },
    "60s"
  );
  const ssoUrl =
    `${DUPLO_SAAS_URL}/api/auth/sso-consume?t=${encodeURIComponent(ssoToken)}` +
    `&next=${encodeURIComponent("/minha-revenda")}`;

  return NextResponse.json(
    { ok: true, ssoUrl, user: { id: user.id, email: user.email, name: user.name, role: user.role } },
    { headers: cors }
  );
}
