"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Inbox, Check, Clock, Gift, AlertTriangle, Wallet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, brl } from "@/lib/utils";

type MotherRow = {
  id: string;
  email: string;
  name: string;
  brandName: string;
  brandSlug: string | null;
  active: boolean;
  subscription: { expiresAt: string; status: string } | null;
};

type WalletInfo = { balance: number; pricePerDay: number };

export default function RevendasPage() {
  const [mothers, setMothers] = useState<MotherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string>("");
  const [wallet, setWallet] = useState<WalletInfo>({ balance: 0, pricePerDay: 0 });
  const [accessDenied, setAccessDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/mothers", { cache: "no-store" });
      if (r.status === 403) { setAccessDenied(true); return; }
      const j = await r.json();
      setMothers(j.mothers || []);
    } catch (_) {} finally {
      setLoading(false);
    }
  }, []);

  const loadWallet = useCallback(async () => {
    try {
      const r = await fetch("/api/wallet", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setWallet({
        balance: Number(j?.wallet?.balance || 0),
        pricePerDay: Number(j?.pricePerDay || 0),
      });
    } catch (_) {}
  }, []);

  useEffect(() => { load(); loadWallet(); }, [load, loadWallet]);

  function costFor(dias: number, isTrial: boolean) {
    if (isTrial) return 0;
    return Number((dias * wallet.pricePerDay).toFixed(2));
  }
  function canAfford(dias: number, isTrial: boolean) {
    return isTrial || wallet.balance >= costFor(dias, isTrial);
  }

  async function approveFor(email: string, dias: number, isTrial: boolean) {
    setActing(email);
    const r = await fetch("/api/access/release", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, days: dias, trial: isTrial }),
    });
    setActing("");
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      if (r.status === 402) {
        toast.error(`Saldo insuficiente: faltam ${brl(d.missing || 0)}.`);
      } else {
        toast.error(d.error || "Falha");
      }
      return;
    }
    toast.success(isTrial ? "24h de acesso liberadas!" : `${dias} dia(s) liberados!`);
    load(); loadWallet();
  }

  async function removeReseller(email: string, brandName: string) {
    if (!confirm(
      `Remover a revenda "${brandName}" (${email})?\n\n` +
      `Isso vai APAGAR a conta do usuário, todas as filhas vinculadas a ela, ` +
      `subscriptions, carteira e historico. Esta acao NAO pode ser desfeita.`
    )) return;
    setActing(email);
    const r = await fetch("/api/admin/reset-children", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ confirm: true, emails: [email] }),
    });
    setActing("");
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.error(d.error || "Falha ao remover");
      return;
    }
    const j = await r.json().catch(() => ({}));
    if (j.deletedChildren > 0) {
      toast.success(`Revenda "${brandName}" removida.`);
    } else {
      toast.error("Conta nao encontrada ou ja removida.");
    }
    load();
  }

  if (accessDenied) {
    return (
      <div className="p-6 max-w-2xl animate-fade-in">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
            <h2 className="text-lg font-extrabold mb-1">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground">Esta página é só para o administrador geral.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const now = Date.now();
  const pending = mothers.filter((m) => {
    const exp = m.subscription?.expiresAt ? new Date(m.subscription.expiresAt).getTime() : 0;
    return !m.subscription || exp <= now;
  });
  const active = mothers.filter((m) => {
    const exp = m.subscription?.expiresAt ? new Date(m.subscription.expiresAt).getTime() : 0;
    return m.subscription && exp > now;
  });

  const lowBalance = wallet.balance < wallet.pricePerDay * 7 && wallet.pricePerDay > 0;

  return (
    <div className="p-6 max-w-4xl animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="h-7 w-7 text-amber-400" />
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Revendas</h1>
          <p className="text-sm text-muted-foreground">Aprove e gerencie as contas mãe (revendedores) vinculadas a você.</p>
        </div>
      </div>

      {/* Banner saldo */}
      <Card className={lowBalance ? "border-amber-500/50 bg-amber-500/5" : ""}>
        <CardContent className="py-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div className={"h-10 w-10 rounded-xl grid place-items-center " + (lowBalance ? "bg-amber-500/15 text-amber-400" : "bg-primary/15 text-primary")}>
              {lowBalance ? <AlertTriangle className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Saldo da carteira</div>
              <div className="text-xl font-extrabold">{brl(wallet.balance)}</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Preço por dia</div>
            <div className="text-base font-bold">{brl(wallet.pricePerDay)}</div>
          </div>
          <div className="flex-1 text-right">
            <Link href="/carteira" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-400 to-amber-400 text-black font-bold text-sm hover:opacity-90">
              + Adicionar saldo
            </Link>
            {lowBalance && (<div className="text-[11px] text-amber-400 mt-1">Saldo baixo.</div>)}
          </div>
        </CardContent>
      </Card>

      {/* Cadastros pendentes */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-amber-400" />
            <CardTitle>Revendas pendentes</CardTitle>
            <Badge variant="warning" className="ml-1">{pending.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-md bg-muted/40 animate-pulse" />)}
            </div>
          ) : pending.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">Sem revendas aguardando aprovação.</div>
          ) : (
            <div className="space-y-2">
              {pending.map((m) => {
                const busy = acting === m.email;
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/20">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-semibold">{m.brandName}</div>
                      <div className="text-xs text-muted-foreground">{m.email} {m.brandSlug ? `· /r/${m.brandSlug}` : ""}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => approveFor(m.email, 1, true)}>
                        <Gift className="h-3.5 w-3.5 mr-1" /> 24h grátis
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy || !canAfford(7, false)}
                        title={!canAfford(7, false) ? `Saldo insuficiente (${brl(costFor(7, false))})` : `Debita ${brl(costFor(7, false))}`}
                        onClick={() => approveFor(m.email, 7, false)}>
                        7 dias · {brl(costFor(7, false))}
                      </Button>
                      <Button size="sm" variant="gradient" disabled={busy || !canAfford(30, false)}
                        title={!canAfford(30, false) ? `Saldo insuficiente (${brl(costFor(30, false))})` : `Debita ${brl(costFor(30, false))}`}
                        onClick={() => approveFor(m.email, 30, false)}>
                        <Check className="h-3.5 w-3.5 mr-1" /> {busy ? "Liberando..." : `30 dias · ${brl(costFor(30, false))}`}
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy}
                        title="Remover esta revenda (apaga conta, filhas, carteira e historico)"
                        onClick={() => removeReseller(m.email, m.brandName)}
                        className="text-rose-400 border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/60">
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revendas ativas */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-400" />
            <CardTitle>Revendas ativas</CardTitle>
            <Badge variant="success" className="ml-1">{active.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? null : active.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">Sem revendas ativas.</div>
          ) : (
            <div className="space-y-2">
              {active.map((m) => {
                const busy = acting === m.email;
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/20">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-semibold flex items-center gap-2">
                        {m.brandName}
                        <Badge variant="success">Ativa</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {m.email} {m.subscription?.expiresAt ? `· expira ${formatDate(m.subscription.expiresAt)}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" disabled={busy || !canAfford(7, false)}
                        onClick={() => approveFor(m.email, 7, false)}>
                        +7 dias · {brl(costFor(7, false))}
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy || !canAfford(30, false)}
                        onClick={() => approveFor(m.email, 30, false)}>
                        +30 dias · {brl(costFor(30, false))}
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy}
                        title="Remover esta revenda (apaga conta, filhas, carteira e historico)"
                        onClick={() => removeReseller(m.email, m.brandName)}
                        className="text-rose-400 border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/60">
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
