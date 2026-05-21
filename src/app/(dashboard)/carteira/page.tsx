"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { brl, formatDate } from "@/lib/utils";
import { Banknote, Plus, RefreshCw, Copy, X, Loader2, CheckCircle2 } from "lucide-react";
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

type DepositCharge = {
  id: string;
  amount: number;
  qrCodeBase64: string | null;
  copiaECola: string | null;
  status: string;
};

export default function CarteiraPage() {
  const router = useRouter();
  const [data, setData] = useState<WalletData | null>(null);
  const [form, setForm] = useState({ amount: "", pixKeyType: "CPF", pixKey: "", note: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);

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
        <Button variant="gradient" onClick={() => setDepositOpen(true)}><Plus className="h-4 w-4" /> Adicionar saldo</Button>
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

      {depositOpen && (
        <DepositModal
          onClose={() => setDepositOpen(false)}
          onPaid={() => { setDepositOpen(false); load(); }}
        />
      )}

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

function DepositModal({ onClose, onPaid }: { onClose: () => void; onPaid: () => void }) {
  const [amount, setAmount] = useState("");
  const [generating, setGenerating] = useState(false);
  const [charge, setCharge] = useState<DepositCharge | null>(null);
  const [paid, setPaid] = useState(false);

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    if (!value || value <= 0) { toast.error("Informe um valor válido"); return; }
    setGenerating(true);
    try {
      const r = await fetch("/api/deposits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: value }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || "Falha ao gerar Pix"); return; }
      setCharge(j);
    } finally {
      setGenerating(false);
    }
  }

  // polling: enquanto o modal estiver aberto com cobrança gerada, consulta status a cada 4s.
  useEffect(() => {
    if (!charge?.id || paid) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/deposits/${charge.id}`);
        const j = await r.json();
        if (stop) return;
        if (j.status === "APPROVED") {
          setPaid(true);
          toast.success("Pagamento confirmado!");
          setTimeout(onPaid, 1500);
        }
      } catch { /* ignora */ }
    };
    const iv = setInterval(tick, 4000);
    return () => { stop = true; clearInterval(iv); };
  }, [charge?.id, paid, onPaid]);

  async function copiar() {
    if (!charge?.copiaECola) return;
    await navigator.clipboard.writeText(charge.copiaECola);
    toast.success("Código copiado");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border rounded-2xl w-full max-w-md p-5 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        <h2 className="text-lg font-extrabold mb-4">Adicionar saldo via Pix</h2>

        {!charge && (
          <form onSubmit={gerar} className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold">Valor (R$)</span>
              <Input
                required autoFocus inputMode="decimal" placeholder="Ex: 17,99"
                value={amount} onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <Button type="submit" variant="gradient" disabled={generating} className="w-full">
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</> : "Gerar QR Code Pix"}
            </Button>
          </form>
        )}

        {charge && !paid && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Valor: <span className="font-bold text-foreground">{brl(charge.amount)}</span></div>
            {charge.qrCodeBase64 && (
              <div className="flex justify-center bg-white rounded-xl p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="QR Code Pix" src={`data:image/png;base64,${charge.qrCodeBase64}`} className="w-56 h-56" />
              </div>
            )}
            {charge.copiaECola && (
              <div>
                <div className="text-xs font-semibold mb-1">Pix copia-e-cola</div>
                <div className="flex gap-2">
                  <input readOnly value={charge.copiaECola} className="flex-1 h-10 rounded-lg border bg-input px-3 text-xs font-mono" />
                  <Button type="button" onClick={copiar}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Aguardando pagamento...
            </div>
          </div>
        )}

        {paid && (
          <div className="flex flex-col items-center text-center py-6 gap-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <div className="font-bold">Pagamento confirmado!</div>
            <div className="text-xs text-muted-foreground">Saldo creditado na sua carteira.</div>
          </div>
        )}
      </div>
    </div>
  );
}
