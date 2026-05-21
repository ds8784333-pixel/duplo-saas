// API publico: dados de marca do reseller pelo slug.
// Usado pela landing branded /[slug], pelo form de cadastro branded
// e pelo Duplo Pro em /r/:slug (conta filha — branding cross-origin).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60, s-maxage=300",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const safe = slug.toLowerCase();
  const r = await db.reseller.findUnique({
    where: { brandSlug: safe },
    select: { brandName: true, brandSlug: true, logoUrl: true, whatsapp: true },
  });
  if (!r) {
    return NextResponse.json({ error: "Revenda nao encontrada" }, { status: 404, headers: CORS_HEADERS });
  }
  return NextResponse.json(r, { headers: CORS_HEADERS });
}
