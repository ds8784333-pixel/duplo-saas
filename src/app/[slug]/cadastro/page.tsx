// Form de cadastro branded — abre dentro do link de afiliado.
// Envia resellerSlug pra /api/auth/register vincular como conta filha
// (role USER, sem opcao de admin).
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BrandedSignupForm from "./form";

const RESERVED = new Set([
  "login", "register", "dashboard", "carteira", "usuarios",
  "subrevendas", "minha-revenda", "liberar-acesso", "api",
]);

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const safe = slug.toLowerCase();
  if (RESERVED.has(safe)) notFound();

  const reseller = await db.reseller.findUnique({
    where: { brandSlug: safe },
    select: { brandName: true, brandSlug: true, logoUrl: true },
  });
  if (!reseller) notFound();

  return (
    <BrandedSignupForm
      brandName={reseller.brandName || ""}
      brandSlug={reseller.brandSlug}
      logoUrl={reseller.logoUrl}
    />
  );
}
