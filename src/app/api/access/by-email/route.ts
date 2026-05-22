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

  // Revenda/admin: acesso livre, sem checagem de subscription.
  if (user.role !== "USER") {
    return NextResponse.json({ status: "reseller" }, { headers: CORS });
  }

  // Cliente comum sem revenda mae cadastrada (orfao).
  const parentProfile = user.reseller?.resellerProfile;
  if (!user.resellerId || !parentProfile?.brandSlug) {
    return NextResponse.json({ status: "no_reseller" }, { headers: CORS });
  }

  const now = new Date();
  const sub = await db.subscription.findFirst({
    where: { userId: user.id, status: "ACTIVE", expiresAt: { gt: now } },
    orderBy: { expiresAt: "desc" },
    select: { expiresAt: true, isTrial: true },
  });

  if (!sub) {
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

  return NextResponse.json(
    {
      status: "active",
      brandSlug: parentProfile.brandSlug,
      brandName: parentProfile.brandName,
      whatsapp: parentProfile.whatsapp,
      expiresAt: sub.expiresAt.toISOString(),
      isTrial: sub.isTrial,
    },
    { headers: CORS }
  );
}
