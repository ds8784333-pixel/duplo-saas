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

export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const email = body.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });

  // Resolve a revenda mae a partir do slug. Slug invalido / ausente =
  // resellerId fica null (orfao, USER comum). Tambem capturamos o ROLE
  // da revenda mae pra decidir se o novo cadastro vira RESELLER (so se
  // o parent for o super-admin com role ADMIN) ou USER comum.
  let resellerId: string | null = null;
  let parentIsAdmin = false;
  if (body.data.resellerSlug) {
    const r = await db.reseller.findUnique({
      where: { brandSlug: body.data.resellerSlug },
      select: { userId: true, user: { select: { role: true } } },
    });
    if (r) {
      resellerId = r.userId;
      parentIsAdmin = r.user.role === "ADMIN";
    }
  }

  // POLITICA DE ROLES:
  // - parent eh ADMIN (super) -> NOVO RESELLER (tem ADM). Esse e o
  //   unico jeito de virar revenda — cadastro pelo link da super.
  // - parent eh outra revenda OU sem parent -> USER (sem ADM).
  //
  // Antes: cadastro sem slug virava RESELLER automaticamente, virando
  // buraco de seguranca (qualquer um se autocadastrava como revenda).
  const isNewReseller = parentIsAdmin;
  let resellerProfileData = undefined;
  if (isNewReseller) {
    // Gera slug unico pra brand do novo reseller (baseado no nome).
    const base = (body.data.name || "")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "revenda";
    let slug = base;
    let i = 1;
    while (await db.reseller.findUnique({ where: { brandSlug: slug } })) {
      slug = `${base}-${i++}`;
    }
    resellerProfileData = { resellerProfile: { create: { brandName: body.data.name, brandSlug: slug } } };
  }

  const user = await db.user.create({
    data: {
      email,
      name: body.data.name,
      passwordHash: hashPassword(body.data.password),
      role: isNewReseller ? "RESELLER" : "USER",
      resellerId,
      wallet: { create: {} },
      ...(resellerProfileData || {}),
    },
  });

  // Auto-login no duplo-saas SOMENTE pra RESELLER novo (precisa do
  // painel pra liberar acesso dos seus clientes). USERs comuns nao
  // recebem cookie aqui — eles operam no Duplo Pro, e setar cookie aqui
  // faria getCurrentUser() retornar o USER quando o super-admin
  // acessasse o painel no mesmo navegador (sequestro de sessao).
  if (isNewReseller) {
    const token = await signSession({ sub: user.id, email: user.email, role: user.role, rid: user.resellerId });
    await setSessionCookie(token);
  }
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}
