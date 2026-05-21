import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, signSession, setSessionCookie } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  resellerSlug: z.string().optional(), // se vier de um link de revenda
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "revenda";
}

export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const email = body.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });

  // se passou um resellerSlug, vincula como cliente do reseller
  let resellerId: string | null = null;
  if (body.data.resellerSlug) {
    const r = await db.reseller.findUnique({ where: { brandSlug: body.data.resellerSlug } });
    if (r) resellerId = r.userId;
  }

  // gera slug único pra reseller profile (todos novos cadastros viram RESELLER do topo neste skeleton)
  let baseSlug = slugify(body.data.name);
  let slug = baseSlug;
  let i = 1;
  while (await db.reseller.findUnique({ where: { brandSlug: slug } })) { slug = `${baseSlug}-${i++}`; }

  const user = await db.user.create({
    data: {
      email,
      name: body.data.name,
      passwordHash: hashPassword(body.data.password),
      role: resellerId ? "USER" : "RESELLER",
      resellerId,
      wallet: { create: {} },
      ...(resellerId ? {} : { resellerProfile: { create: { brandName: body.data.name, brandSlug: slug } } }),
    },
  });

  // Conta filha (com resellerSlug) NAO recebe cookie de sessao no duplo-saas:
  // ela opera dentro do Duplo Pro (/r/:slug), que tem seu proprio fluxo de
  // autenticacao. Deixar cookie aqui faria getCurrentUser() retornar a filha
  // quando o admin acessar o painel do mesmo navegador.
  // Cadastro sem resellerSlug = novo RESELLER => mantemos auto-login.
  if (!resellerId) {
    const token = await signSession({ sub: user.id, email: user.email, role: user.role, rid: user.resellerId });
    await setSessionCookie(token);
  }
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}
