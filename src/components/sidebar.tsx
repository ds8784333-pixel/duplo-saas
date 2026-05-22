"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, KeyRound, Wallet, Network, Home, LogOut, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard",        label: "Dashboard",       icon: LayoutDashboard },
  { href: "/usuarios",         label: "Usuários",        icon: Users },
  { href: "/liberar-acesso",   label: "Liberar acesso",  icon: KeyRound },
  { href: "/carteira",         label: "Carteira",        icon: Wallet },
  { href: "/subrevendas",      label: "Subrevendas",     icon: Network },
  { href: "/minha-revenda",    label: "Minha revenda",   icon: Home },
];

export function Sidebar({ brand }: { brand?: { name: string; logoUrl?: string | null } }) {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 flex-col border-r bg-card/40 backdrop-blur sticky top-0 h-screen">
      <div className="flex items-center gap-3 p-4 border-b">
        <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center overflow-hidden">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Zap className="h-5 w-5" />
          )}
        </div>
        <div className="leading-tight">
          <div className="text-sm font-extrabold">{brand?.name || "DuploOdds"}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Revendedor</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {NAV.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          const Icon = it.icon;
          return (
            <Link key={it.href} href={it.href}>
              <motion.div
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold mb-1 transition",
                  active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{it.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      <form action="/api/auth/logout" method="POST" className="p-3 border-t">
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full px-3 py-2 rounded-lg hover:bg-muted/60">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </form>
    </aside>
  );
}
