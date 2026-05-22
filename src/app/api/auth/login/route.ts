import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, signSession, setSessionCookie } from "@/lib/auth";
import { DUPLO_PRO_URL } from "@/lib/config";

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const u = await db.user.findUnique({
    where: { email: body.data.email.toLowerCase() },
    include: { reseller: { include: { resellerProfile: true } } },
  });
  if (!u || !u.active || !verifyPassword(body.data.password, u.passwordHash)) {
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  // Conta filha (cliente comum) NAO loga no painel admin do duplo-saas.
  // Ela tem que usar o Duplo Pro — preferencialmente o link branded
  // /r/<slug-da-revenda-mae> se a revenda dela tiver slug definido.
  if (u.role === "USER") {
    const slug = u.reseller?.resellerProfile?.brandSlug || "";
    const redirectTo = slug ? `${DUPLO_PRO_URL}/r/${slug}` : `${DUPLO_PRO_URL}/login`;
    return NextResponse.json(
      {
        error: "Esta tela é só para revendas. Você é cliente — acesse pelo Duplo Pro.",
        redirectTo,
      },
      { status: 403 }
    );
  }

  // login log (anti-share base)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  const ua = req.headers.get("user-agent") || "";
  await db.$transaction([
    db.loginLog.create({ data: { userId: u.id, ip, userAgent: ua, success: true } }),
    db.user.update({ where: { id: u.id }, data: { lastLoginAt: new Date(), lastLoginIp: ip } }),
  ]);

  const token = await signSession({ sub: u.id, email: u.email, role: u.role, rid: u.resellerId });
  await setSessionCookie(token);
  return NextResponse.json({ ok: true, user: { id: u.id, email: u.email, role: u.role, name: u.name } });
}
