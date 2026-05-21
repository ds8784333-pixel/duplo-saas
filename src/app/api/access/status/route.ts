// API publico (CORS aberto): consulta se um email tem subscription ATIVA
// dentro da revenda do slug informado. Usado pelo Duplo Pro em /r/:slug
// pra decidir entre "mostrar scanner branded" e "mostrar tela Quase la".
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
  const slug = (req.nextUrl.searchParams.get("slug") || "").toLowerCase().trim();
  if (!email || !slug) {
    return NextResponse.json({ error: "Parametros obrigatorios: email, slug" }, { status: 400, headers: CORS });
  }

  const reseller = await db.reseller.findUnique({
    where: { brandSlug: slug },
    select: { userId: true, brandName: true, logoUrl: true, whatsapp: true },
  });
  if (!reseller) {
    return NextResponse.json({ error: "Revenda nao encontrada" }, { status: 404, headers: CORS });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, resellerId: true },
  });

  if (!user) {
    return NextResponse.json(
      { status: "unregistered", brandName: reseller.brandName, whatsapp: reseller.whatsapp },
      { headers: CORS }
    );
  }

  // So conta como conta filha dessa revenda se resellerId bate.
  if (user.resellerId !== reseller.userId) {
    return NextResponse.json(
      { status: "wrong_reseller", brandName: reseller.brandName },
      { headers: CORS }
    );
  }

  const now = new Date();
  const sub = await db.subscription.findFirst({
    where: { userId: user.id, status: "ACTIVE", expiresAt: { gt: now } },
    orderBy: { expiresAt: "desc" },
    select: { expiresAt: true, isTrial: true },
  });

  if (!sub) {
    return NextResponse.json(
      { status: "pending", brandName: reseller.brandName, whatsapp: reseller.whatsapp },
      { headers: CORS }
    );
  }

  return NextResponse.json(
    {
      status: "active",
      brandName: reseller.brandName,
      logoUrl: reseller.logoUrl,
      whatsapp: reseller.whatsapp,
      expiresAt: sub.expiresAt.toISOString(),
      isTrial: sub.isTrial,
    },
    { headers: CORS }
  );
}
