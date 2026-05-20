"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { brl, formatDate } from "@/lib/utils";
import { Banknote, Plus, RefreshCw } from "lucide-react";
import { StatsCard } from "@/components/stats-card";
import { toast } from "sonner";
import { useWS } from "@/hooks/use-ws";
import { useRouter } from "next/navigation";

type Tx = { id: string; type: string; amount: string; balanceAfter: string; description: string; createdAt: string };
type WalletData = {
  user: { id: string; name: string; brandName?: string | null };
  wallet: { balance: string; pendingBalance: string; totalIn: string; totalOut: string };
  transactions: Tx[];
  withdraws: { id: string; amount: string; pixKey: string; status: string; createdAt: string }[];
  pricePerDay: number;
};

const STATUS_COLOR: Record<string, "warning" | "success" | "danger" | "info"> = {
  PENDING: "warning", APPROVED: "info", PAID: "success", REJECTED: "danger",
};

export default function CarteiraPage() {
  const router = useRouter();
  const [data, setData] = useState<WalletData | null>(null);
  const [form, setForm] = useState({ amount: "", pixKeyType: "CPF", pixKey: "", note: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/wallet");
    const j = await r.json();
    setData(j);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // realtime
  const { last } = useWS<{ type: string }>(`wallet:${data?.user.id || ""}`);
  useEffect(() => { if (last?.type === "wallet.updated") load(); }, [last]);

  async function solicitar(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const r = await fetch("/api/withdraws", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount.replace(",", ".")) }),
    });
    setSubmitting(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.error(d.error || "Falha ao solicitar");
      return;
    }
    toast.success("Saque solicitado!");
    setForm({ amount: "", pixKeyType: "CPF", pixKey: "", note: "" });
    load();
    router.refresh();
  }

  if (loading || !data) {
    return <div className="p-6 space-y-4">
      <div className="h-8 w-48 bg-muted/40 rounded animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted/30 animate-pulse" />)}
      </div>
    </div>;
  }

  const w = data.wallet;

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Carteira da revenda</h1>
          <p className="text-sm text-muted-foreground">{data.user.brandName || data.user.name}</p>
        </div>
        <Button variant="gradient"><Plus className="h-4 w-4" /> Adicionar saldo</Button>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatsCard label="Saldo atual" value={brl(w.balance)} color="emerald" />
        <StatsCard label="Preço por dia" value={brl(data.pricePerDay)} color="cyan" />
        <StatsCard label="Entradas" value={brl(w.totalIn)} color="violet" />
        <StatsCard label="Saídas" value={brl(w.totalOut)} color="amber" />
        <StatsCard label="Comissão pendente" value={brl(w.pendingBalance)} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-primary" /><CardTitle>Histórico financeiro</CardTitle></div>
            <button onClick={load} className="text-muted-foreground hover:text-foreground"><RefreshCw className="h-4 w-4" /></button>
          </CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Data</TH><TH>Tipo</TH><TH>Descrição</TH><TH className="text-right">Valor</TH><TH className="text-right">Saldo após</TH></TR></THead>
              <TBody>
                {data.transactions.map((t) => (
                  <TR key={t.id}>
                    <TD className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</TD>
                    <TD><span className="text-xs font-semibold uppercase">{t.type}</span></TD>
                    <TD className="text-muted-foreground">{t.description}</TD>
                    <TD className={"text-right font-bold " + (Number(t.amount) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {Number(t.amount) >= 0 ? "+" : ""}{brl(t.amount)}
                    </TD>
                    <TD className="text-right text-muted-foreground">{brl(t.balanceAfter)}</TD>
                  </TR>
                ))}
                {data.transactions.length === 0 && (
                  <TR><TD colSpan={5} className="text-center text-muted-foreground py-8">Sem movimentações ainda.</TD></TR>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Saque de comissão</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={solicitar} className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">Disponível</div>
                <div className="text-lg font-extrabold text-primary">{brl(w.balance)}</div>
              </div>
              <label className="block">
                <span className="text-xs font-semibold">Valor</span>
                <Input required inputMode="decimal" placeholder="Ex: 150,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold">Chave PIX</span>
                <div className="flex gap-2">
                  <select className="h-10 rounded-lg border bg-input px-3 text-sm"
                    value={form.pixKeyType}
                    onChange={(e) => setForm({ ...form, pixKeyType: e.target.value })}
                  >
                    <option>CPF</option><option>CNPJ</option><option>EMAIL</option><option>PHONE</option><option>RANDOM</option>
                  </select>
                  <Input required value={form.pixKey} onChange={(e) => setForm({ ...form, pixKey: e.target.value })} placeholder="Digite a chave" />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-semibold">Observação</span>
                <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Opcional" />
              </label>
              <Button type="submit" variant="gradient" disabled={submitting} className="w-full">{submitting ? "Enviando..." : "Solicitar saque"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Histórico de solicitações de saque</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>Data</TH><TH className="text-right">Valor</TH><TH>PIX</TH><TH>Status</TH></TR></THead>
            <TBody>
              {data.withdraws.map((w) => (
                <TR key={w.id}>
                  <TD className="text-xs text-muted-foreground">{formatDate(w.createdAt)}</TD>
                  <TD className="text-right font-bold text-emerald-400">{brl(w.amount)}</TD>
                  <TD className="text-muted-foreground">{w.pixKey}</TD>
                  <TD><Badge variant={STATUS_COLOR[w.status] || "default"}>{w.status}</Badge></TD>
                </TR>
              ))}
              {data.withdraws.length === 0 && <TR><TD colSpan={4} className="text-center text-muted-foreground py-8">Sem saques.</TD></TR>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
