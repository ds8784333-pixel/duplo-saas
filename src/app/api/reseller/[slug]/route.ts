// API público: dados de marca do reseller pelo slug.
// Usado pela landing branded /[slug] e pelo form de cadastro branded.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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
  if (!r) return NextResponse.json({ error: "Revenda não encontrada" }, { status: 404 });
  return NextResponse.json(r);
}
