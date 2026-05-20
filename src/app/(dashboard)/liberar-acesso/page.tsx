"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Gift } from "lucide-react";
import { toast } from "sonner";

export default function LiberarPage() {
  const [email, setEmail] = useState("");
  const [days, setDays] = useState("30");
  const [trial, setTrial] = useState(false);
  const [loading, setLoading] = useState(false);

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
  }

  return (
    <div className="p-6 max-w-2xl animate-fade-in">
      <h1 className="text-2xl font-extrabold mb-1">Liberar acesso</h1>
      <p className="text-sm text-muted-foreground mb-6">Libere ou renove acesso por dias. Use "24h grátis" para trial.</p>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /><CardTitle>Novo acesso</CardTitle></div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold">E-mail do cliente</span>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
              <span className="text-[11px] text-muted-foreground">Se o usuário não existir, será criado.</span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold">Dias</span>
              <Input type="number" min={1} max={365} required value={days} onChange={(e) => setDays(e.target.value)} disabled={trial} />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={trial} onChange={(e) => setTrial(e.target.checked)} />
              <Gift className="h-4 w-4 text-primary" />
              <span className="text-sm">Liberar 24h grátis (trial)</span>
            </label>
            <Button type="submit" variant="gradient" disabled={loading}>{loading ? "Liberando..." : "Liberar acesso"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
