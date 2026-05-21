// Landing branded da revenda — acessível pelo link de afiliado.
// Renderiza server-side. Slug invalido => 404.
import { notFound } from "next/navigation";
import Link from "next/link";
import { Zap } from "lucide-react";
import { db } from "@/lib/db";

// rotas estáticas do app que NÃO devem ser tratadas como slug de revenda.
// Apenas rotas que JÁ existem no app como páginas/diretorios.
// Slugs como "admin", "duplo" sao permitidos como nomes de revenda.
const RESERVED = new Set([
  "login", "register", "dashboard", "carteira", "usuarios",
  "subrevendas", "minha-revenda", "liberar-acesso", "api",
  "favicon.ico", "robots.txt", "sitemap.xml",
]);

export default async function BrandedLanding({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const safe = slug.toLowerCase();
  if (RESERVED.has(safe)) notFound();

  const reseller = await db.reseller.findUnique({
    where: { brandSlug: safe },
    select: { brandName: true, brandSlug: true, logoUrl: true, whatsapp: true },
  });
  if (!reseller) notFound();

  return (
    <div className="min-h-screen bg-background grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card/60 backdrop-blur p-8 space-y-6 animate-fade-in">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-20 w-20 rounded-2xl overflow-hidden bg-muted/30 grid place-items-center">
            {reseller.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reseller.logoUrl} alt={reseller.brandName || ""} className="h-full w-full object-cover" />
            ) : (
              <Zap className="h-10 w-10 text-primary" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold">{reseller.brandName || "Bem-vindo"}</h1>
          <p className="text-sm text-muted-foreground">
            Acesse sua conta ou crie uma agora pra liberar o serviço.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href={`/${reseller.brandSlug}/cadastro`}
            className="inline-flex items-center justify-center h-11 px-4 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition"
          >
            Criar conta
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-11 px-4 rounded-lg border border-primary/40 text-primary font-semibold hover:bg-primary/10 transition"
          >
            Já tenho conta
          </Link>
        </div>

        {reseller.whatsapp ? (
          <div className="text-center text-xs text-muted-foreground">
            Suporte:{" "}
            <a
              href={`https://wa.me/${reseller.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              WhatsApp
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
