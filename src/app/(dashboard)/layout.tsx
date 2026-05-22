import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { DUPLO_PRO_URL } from "@/lib/config";
import { clearSessionCookie } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Conta filha (cliente comum) nao deve ver o painel de revenda.
  // Limpa o cookie pra ela nao ficar presa num loop e redireciona pro
  // Duplo Pro com o slug da revenda mae (se houver) ou login generico.
  if (user.role === "USER") {
    let slug = "";
    if (user.resellerId) {
      const parent = await db.user.findUnique({
        where: { id: user.resellerId },
        select: { resellerProfile: { select: { brandSlug: true } } },
      });
      slug = parent?.resellerProfile?.brandSlug || "";
    }
    await clearSessionCookie();
    redirect(slug ? `${DUPLO_PRO_URL}/r/${slug}` : `${DUPLO_PRO_URL}/login`);
  }

  const brand = {
    name: user.resellerProfile?.brandName || user.name || "DuploOdds",
    logoUrl: user.resellerProfile?.logoUrl,
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar brand={brand} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
