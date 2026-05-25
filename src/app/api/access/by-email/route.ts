// Consulta o status de acesso de um email no duplo-saas, sem precisar saber
// o slug da revenda. Usado pelo Duplo Pro pra decidir se libera o scanner
// ou redireciona pra tela "Quase la!" (status=pending).
//
// Resposta:
//   - { status: "unregistered" }                              -> email nao existe (Duplo Pro decide)
//   - { status: "reseller", brandSlug? }                      -> e ADMIN/RESELLER (acesso livre)
//   - { status: "active",  brandSlug, brandName, expiresAt }  -> tem sub ativa
//   - { status: "pending", brandSlug, brandName, whatsapp }   -> sem sub ativa
//   - { status: "no_reseller" }                               -> e USER mas sem revenda (orfao)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("email") || "").toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: "Parametro obrigatorio: email" }, { status: 400, headers: CORS });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true, role: true, resellerId: true,
      reseller: {
        select: {
          role: true,
          resellerProfile: {
            select: { brandSlug: true, brandName: true, whatsapp: true },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ status: "unregistered" }, { headers: CORS });
  }

  // ADMIN (super): acesso ADM total. Nao tem subscription propria.
  if (user.role === "ADMIN") {
    return NextResponse.json({ status: "reseller" }, { headers: CORS });
  }

  // RESELLER: SO retorna "reseller" se parent eh ADMIN (criado via link da super).
  // Resellers nao-vindas do link da super tem o ADM escondido — o botao no
  // scanner aparece apenas pra quem realmente representa o Duplo Pro.
  // Inclui expiresAt/isTrial da PROPRIA sub (criada pela super-admin no
  // /liberar-acesso) pra que o card "Dias Restantes" no scanner renderize
  // corretamente — sem isso a mae enxergava sempre "—".
  if (user.role === "RESELLER") {
    if (user.reseller?.role === "ADMIN") {
      const now = new Date();
      const motherSub = await db.subscription.findFirst({
        where: { userId: user.id, status: "ACTIVE", expiresAt: { gt: now } },
        orderBy: { expiresAt: "desc" },
        select: { expiresAt: true, isTrial: true },
      });
      return NextResponse.json(
        {
          status: "reseller",
          ...(motherSub
            ? {
                expiresAt: motherSub.expiresAt.toISOString(),
                isTrial: motherSub.isTrial,
              }
            : {}),
        },
        { headers: CORS }
      );
    }
    // RESELLER "rogue" (sem parent ou parent nao-ADMIN) → trata como USER:
    // cai pra checagem de subscription / no_reseller abaixo.
  }

  // SUBRESELLER nunca tem ADM (sao filhas de revendas, nao da super).

  const parentProfile = user.reseller?.resellerProfile;

  // Checa subscription ANTES do gate de reseller — usuario orfao (sem
  // revenda mae) que paga direto pelo Duplo Pro (Mercado Pago / orphan
  // paywall) tem subscription ativa e deve receber status='active' mesmo
  // sem resellerId. O webhook /api/mp-webhook cria essa subscription.
  const now = new Date();
  const sub = await db.subscription.findFirst({
    where: { userId: user.id, status: "ACTIVE", expiresAt: { gt: now } },
    orderBy: { expiresAt: "desc" },
    select: { expiresAt: true, isTrial: true },
  });

  if (sub) {
    return NextResponse.json(
      {
        status: "active",
        brandSlug: parentProfile?.brandSlug,
        brandName: parentProfile?.brandName,
        whatsapp: parentProfile?.whatsapp,
        expiresAt: sub.expiresAt.toISOString(),
        isTrial: sub.isTrial,
      },
      { headers: CORS }
    );
  }

  // Sem subscription ativa: usuario sem revenda mae = orfao (precisa pagar
  // direto pelo orphan paywall). Usuario com revenda mae = pending (revenda
  // ainda nao liberou).
  if (!user.resellerId || !parentProfile?.brandSlug) {
    return NextResponse.json({ status: "no_reseller" }, { headers: CORS });
  }

  return NextResponse.json(
    {
      status: "pending",
      brandSlug: parentProfile.brandSlug,
      brandName: parentProfile.brandName,
      whatsapp: parentProfile.whatsapp,
    },
    { headers: CORS }
  );
}
