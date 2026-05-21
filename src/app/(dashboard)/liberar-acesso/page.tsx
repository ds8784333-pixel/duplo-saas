"use client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Gift, Inbox, Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

type ChildRow = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  subscription: { expiresAt: string; status: string } | null;
};

export default function LiberarPage() {
  const [email, setEmail] = useState("");
  const [days, setDays] = useState("30");
  const [trial, setTrial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string>("");

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

  useEffect(() => { loadChildren(); }, [loadChildren]);

  async function releaseFor(targetEmail: string, dias: number, isTrial: boolean) {
    setActingOn(targetEmail);
    const r = await fetch("/api/access/release", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: targetEmail, days: dias, trial: isTrial }),
    });
    setActingOn("");
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.error(d.error || "Falha");
      return;
    }
    toast.success(isTrial ? "Trial 24h liberado!" : `Acesso de ${dias} dia(s) liberado!`);
    loadChildren();
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
      toast.error(d.error || "Falha");
      return;
    }
    toast.success("Acesso liberado!");
    setEmail("");
    loadChildren();
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

  return (
    <div className="p-6 max-w-4xl animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Liberar acesso</h1>
        <p className="text-sm text-muted-foreground">Aprove cadastros pendentes ou libere/renove acesso por dias.</p>
      </div>

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
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => releaseFor(u.email, 7, false)}>
                        7 dias
                      </Button>
                      <Button size="sm" variant="gradient" disabled={busy} onClick={() => releaseFor(u.email, 30, false)}>
                        <Check className="h-3.5 w-3.5 mr-1" /> {busy ? "Liberando..." : "30 dias"}
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
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => releaseFor(u.email, 7, false)}>
                        +7 dias
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => releaseFor(u.email, 30, false)}>
                        +30 dias
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
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={trial} onChange={(e) => setTrial(e.target.checked)} />
              <Gift className="h-4 w-4 text-primary" />
              <span className="text-sm">Liberar 24h gratis (trial)</span>
            </label>
            <Button type="submit" variant="gradient" disabled={loading}>{loading ? "Liberando..." : "Liberar acesso"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
