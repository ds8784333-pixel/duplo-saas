import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

// Login removido — se nao houver sessao, renderiza com marca padrao "Admin"
// (o app roda dentro do iframe ADM do Duplo Pro).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);

  const brand = {
    name: user?.resellerProfile?.brandName || user?.name || "Admin",
    logoUrl: user?.resellerProfile?.logoUrl,
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar brand={brand} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
