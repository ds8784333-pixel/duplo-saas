"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type Row = {
  id: string; email: string; name: string; phone: string | null; active: boolean;
  sharingFlagged: boolean; lastLoginAt: string | null; lastLoginIp: string | null;
  subscription: { expiresAt: string; status: string } | null;
};

export default function UsuariosPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "flagged">("all");
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/users").then((r) => r.json()).then((d) => { setData(d.users || []); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.filter((u) => {
      if (filter === "active" && !u.active) return false;
      if (filter === "inactive" && u.active) return false;
      if (filter === "flagged" && !u.sharingFlagged) return false;
      if (!s) return true;
      return [u.email, u.name, u.phone || ""].some((x) => x.toLowerCase().includes(s));
    });
  }, [q, filter, data]);

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Usuários</h1>
          <p className="text-sm text-muted-foreground">{data.length} no total · {filtered.length} exibidos</p>
        </div>
        <a href="/api/users?format=csv">
          <Button variant="outline">Exportar CSV</Button>
        </a>
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-1 items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou celular..." className="pl-9" />
            </div>
            <div className="flex gap-1 text-xs">
              {(["all","active","inactive","flagged"] as const).map((k) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={"px-3 py-2 rounded-md font-semibold border " + (filter === k ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/30 hover:bg-muted/60")}
                >
                  {k === "all" ? "Todos" : k === "active" ? "Ativos" : k === "inactive" ? "Inativos" : "Suspeitos"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 rounded-md bg-muted/40 animate-pulse" />)}
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nome</TH><TH>E-mail</TH><TH>Celular</TH><TH>Status</TH><TH>Expira em</TH><TH>Último IP</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((u) => (
                  <TR key={u.id}>
                    <TD className="font-semibold flex items-center gap-2">
                      {u.sharingFlagged ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <ShieldCheck className="h-4 w-4 text-emerald-400" />}
                      {u.name}
                    </TD>
                    <TD className="text-muted-foreground">{u.email}</TD>
                    <TD className="text-muted-foreground">{u.phone || "—"}</TD>
                    <TD>
                      {u.active
                        ? <Badge variant="success">Ativo</Badge>
                        : <Badge variant="danger">Inativo</Badge>}
                      {u.sharingFlagged && <Badge variant="warning" className="ml-1"><ShieldAlert className="h-3 w-3 mr-1" /> Suspeito</Badge>}
                    </TD>
                    <TD>{u.subscription ? formatDate(u.subscription.expiresAt) : "—"}</TD>
                    <TD className="text-muted-foreground">{u.lastLoginIp || "—"}</TD>
                  </TR>
                ))}
                {filtered.length === 0 && (
                  <TR><TD colSpan={6} className="text-center text-muted-foreground py-12">Nenhum usuário encontrado.</TD></TR>
                )}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
