"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Gift, Inbox, Check, Clock, AlertTriangle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { formatDate, brl } from "@/lib/utils";

type ChildRow = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  subscription: { expiresAt: string; status: string } | null;
};

type WalletInfo = { balance: number; pricePerDay: number };

export default function LiberarPage() {
  const [email, setEmail] = useState("");
  const [days, setDays] = useState("30");
  const [trial, setTrial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string>("");
  const [wallet, setWallet] = useState<WalletInfo>({ balance: 0, pricePerDay: 0 });

  const loadChildren = useCallback(async () => {
    setChildrenLoading(true);
    try {
      const r = await fetch("/api/users", { cache: "no-store" });
      const j = await r.json();
      setChildren(j.users || []);
    } catch (_) {
      // ignore
    } finally {
      setChildrenLoading(false);
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

  useEffect(() => { loadChildren(); loadWallet(); }, [loadChildren, loadWallet]);

  // Custo de uma liberacao de N dias na revenda atual.
  function costFor(dias: number, isTrial: boolean) {
    if (isTrial) return 0;
    return Number((dias * wallet.pricePerDay).toFixed(2));
  }
  function canAfford(dias: number, isTrial: boolean) {
    return isTrial || wallet.balance >= costFor(dias, isTrial);
  }

  async function releaseFor(targetEmail: string, dias: number, isTrial: boolean) {
    setActingOn(targetEmail);
    const r = await fetch("/api/access/release", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: targetEmail, days: dias, trial: isTrial }),
    });
    setActingOn("");
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      // 402 = Payment Required: saldo insuficiente.
      if (r.status === 402) {
        toast.error(`Saldo insuficiente: faltam ${brl(d.missing || 0)}. Adicione saldo na carteira primeiro.`);
      } else {
        toast.error(d.error || "Falha");
      }
      return;
    }
    toast.success(isTrial ? "Trial 24h liberado!" : `Acesso de ${dias} dia(s) liberado!`);
    loadChildren();
    loadWallet();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch("/api/access/release", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, days: Number(days), trial }),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      if (r.status === 402) {
        toast.error(`Saldo insuficiente: faltam ${brl(d.missing || 0)}. Adicione saldo na carteira.`);
      } else {
        toast.error(d.error || "Falha");
      }
      return;
    }
    toast.success("Acesso liberado!");
    setEmail("");
    loadChildren();
    loadWallet();
  }

  const now = Date.now();
  const pending = children.filter((c) => {
    const exp = c.subscription?.expiresAt ? new Date(c.subscription.expiresAt).getTime() : 0;
    return !c.subscription || exp <= now;
  });
  const active = children.filter((c) => {
    const exp = c.subscription?.expiresAt ? new Date(c.subscription.expiresAt).getTime() : 0;
    return c.subscription && exp > now;
  });

  const lowBalance = wallet.balance < wallet.pricePerDay * 7 && wallet.pricePerDay > 0;

  return (
    <div className="p-6 max-w-4xl animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Liberar acesso</h1>
        <p className="text-sm text-muted-foreground">Aprove cadastros pendentes ou libere/renove acesso por dias.</p>
      </div>

      {/* Banner de saldo: mostra carteira atual + preco/dia + CTA para depositar */}
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
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Preco por dia</div>
              <div className="text-base font-bold">{brl(wallet.pricePerDay)}</div>
            </div>
          </div>
          <div className="flex-1 text-right">
            <Link href="/carteira" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-400 to-amber-400 text-black font-bold text-sm hover:opacity-90">
              + Adicionar saldo
            </Link>
            {lowBalance && (
              <div className="text-[11px] text-amber-400 mt-1">Saldo baixo — adicione antes de liberar mais acessos.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cadastros pendentes — contas filhas sem subscription ativa */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-amber-400" />
            <CardTitle>Cadastros pendentes</CardTitle>
            <Badge variant="warning" className="ml-1">{pending.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {childrenLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-md bg-muted/40 animate-pulse" />)}
            </div>
          ) : pending.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">Sem cadastros aguardando liberacao.</div>
          ) : (
            <div className="space-y-2">
              {pending.map((u) => {
                const busy = actingOn === u.email;
                return (
                  <div key={u.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/20">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => releaseFor(u.email, 1, true)}>
                        <Gift className="h-3.5 w-3.5 mr-1" /> 24h gratis
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !canAfford(7, false)}
                        title={!canAfford(7, false) ? `Saldo insuficiente (${brl(costFor(7, false))})` : `Debita ${brl(costFor(7, false))}`}
                        onClick={() => releaseFor(u.email, 7, false)}
                      >
                        7 dias · {brl(costFor(7, false))}
                      </Button>
                      <Button
                        size="sm"
                        variant="gradient"
                        disabled={busy || !canAfford(30, false)}
                        title={!canAfford(30, false) ? `Saldo insuficiente (${brl(costFor(30, false))})` : `Debita ${brl(costFor(30, false))}`}
                        onClick={() => releaseFor(u.email, 30, false)}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> {busy ? "Liberando..." : `30 dias · ${brl(costFor(30, false))}`}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contas ativas — renovacao rapida */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-400" />
            <CardTitle>Contas ativas</CardTitle>
            <Badge variant="success" className="ml-1">{active.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {childrenLoading ? null : active.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">Sem contas ativas no momento.</div>
          ) : (
            <div className="space-y-2">
              {active.map((u) => {
                const busy = actingOn === u.email;
                return (
                  <div key={u.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/20">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-semibold flex items-center gap-2">
                        {u.name}
                        <Badge variant="success">Ativo</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email} {u.subscription?.expiresAt ? `· expira ${formatDate(u.subscription.expiresAt)}` : ""}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !canAfford(7, false)}
                        title={!canAfford(7, false) ? `Saldo insuficiente (${brl(costFor(7, false))})` : `Debita ${brl(costFor(7, false))}`}
                        onClick={() => releaseFor(u.email, 7, false)}
                      >
                        +7 dias · {brl(costFor(7, false))}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !canAfford(30, false)}
                        title={!canAfford(30, false) ? `Saldo insuficiente (${brl(costFor(30, false))})` : `Debita ${brl(costFor(30, false))}`}
                        onClick={() => releaseFor(u.email, 30, false)}
                      >
                        +30 dias · {brl(costFor(30, false))}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liberacao manual por email — fallback pra quem nao cadastrou pelo link */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /><CardTitle>Liberar por e-mail (manual)</CardTitle></div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold">E-mail do cliente</span>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
              <span className="text-[11px] text-muted-foreground">Se o usuario nao existir, sera criado.</span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold">Dias</span>
              <Input type="number" min={1} max={365} required value={days} onChange={(e) => setDays(e.target.value)} disabled={trial} />
              {!trial && (
                <span className="text-[11px] text-muted-foreground">
                  Custo: <b>{brl(costFor(Number(days) || 0, false))}</b> · Saldo: <b>{brl(wallet.balance)}</b>
                </span>
              )}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={trial} onChange={(e) => setTrial(e.target.checked)} />
              <Gift className="h-4 w-4 text-primary" />
              <span className="text-sm">Liberar 24h gratis (trial)</span>
            </label>
            <Button
              type="submit"
              variant="gradient"
              disabled={loading || (!trial && !canAfford(Number(days) || 0, false))}
              title={!trial && !canAfford(Number(days) || 0, false) ? "Saldo insuficiente — adicione saldo na carteira" : undefined}
            >
              {loading ? "Liberando..." : "Liberar acesso"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
