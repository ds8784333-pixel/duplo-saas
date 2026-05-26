"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, KeyRound, Wallet, Home, LogOut, Zap, Crown, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard",        label: "Dashboard",       icon: LayoutDashboard },
  { href: "/usuarios",         label: "Usuários",        icon: Users },
  { href: "/liberar-acesso",   label: "Liberar acesso",  icon: KeyRound },
  { href: "/carteira",         label: "Carteira",        icon: Wallet },
  { href: "/minha-revenda",    label: "Minha revenda",   icon: Home },
];
// Item extra visivel SO pro super-admin geral (ds8784333@gmail.com).
const SUPER_NAV = [
  { href: "/revendas", label: "Revendas", icon: Crown },
];

type SidebarProps = { brand?: { name: string; logoUrl?: string | null }; isSuper?: boolean };

export function Sidebar({ brand, isSuper }: SidebarProps) {
  const pathname = usePathname();
  const nav = isSuper ? [...SUPER_NAV, ...NAV] : NAV;
  const [open, setOpen] = useState(false);

  // Fecha o drawer ao navegar (ao clicar num link, o pathname muda).
  useEffect(() => { setOpen(false); }, [pathname]);
  // Fecha com Esc; trava o scroll do body enquanto aberto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [open]);

  const navList = (
    <nav className="flex-1 overflow-y-auto p-2">
      {nav.map((it) => {
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
  );

  const brandHeader = (
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
        <div className="text-sm font-extrabold">{brand?.name || "Duplo Pro"}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Revendedor</div>
      </div>
    </div>
  );

  const logout = (
    <form action="/api/auth/logout" method="POST" className="p-3 border-t">
      <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full px-3 py-2 rounded-lg hover:bg-muted/60">
        <LogOut className="h-4 w-4" /> Sair
      </button>
    </form>
  );

  return (
    <>
      {/* Sidebar fixa (desktop, >= md) */}
      <aside className="hidden md:flex w-60 flex-col border-r bg-card/40 backdrop-blur sticky top-0 h-screen">
        {brandHeader}
        {navList}
        {logout}
      </aside>

      {/* Top bar (mobile, < md) — botao hamburger + brand */}
      <div className="md:hidden sticky top-0 z-40 flex items-center gap-3 p-3 border-b bg-card/80 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="h-10 w-10 grid place-items-center rounded-lg hover:bg-muted/60"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center overflow-hidden">
            {brand?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
          </div>
          <div className="text-sm font-extrabold truncate">{brand?.name || "Duplo Pro"}</div>
        </div>
      </div>

      {/* Drawer (mobile) — overlay + slide-in da esquerda */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="md:hidden fixed inset-0 z-50 bg-black/60"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.2 }}
              className="md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col bg-card border-r shadow-xl"
              role="dialog"
              aria-label="Menu"
            >
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center overflow-hidden">
                    {brand?.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={brand.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Zap className="h-5 w-5" />
                    )}
                  </div>
                  <div className="leading-tight">
                    <div className="text-sm font-extrabold">{brand?.name || "Duplo Pro"}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Revendedor</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar menu"
                  className="h-9 w-9 grid place-items-center rounded-lg hover:bg-muted/60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {navList}
              {logout}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
