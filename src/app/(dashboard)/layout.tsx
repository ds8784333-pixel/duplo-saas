import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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
