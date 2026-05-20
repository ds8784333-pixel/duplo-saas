// Listagem placeholder: o schema (User com self-relation + Reseller + Commission)
// suporta toda a hierarquia. A UI completa de gestão de subrevendas é TODO.
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function SubrevendasPage() {
  const user = (await getCurrentUser())!;
  const subs = await db.user.findMany({
    where: { resellerId: user.id, role: { in: ["SUBRESELLER", "RESELLER"] } },
    include: { resellerProfile: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-extrabold">Subrevendas</h1>
      <p className="text-sm text-muted-foreground">Revendedores abaixo de você. Gestão completa (limites, comissão) é TODO.</p>

      <Card>
        <CardHeader><CardTitle>Subrevendas — {subs.length}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>Nome</TH><TH>E-mail</TH><TH>Marca</TH><TH>Status</TH><TH>Criada em</TH></TR></THead>
            <TBody>
              {subs.map((s) => (
                <TR key={s.id}>
                  <TD className="font-semibold">{s.name}</TD>
                  <TD className="text-muted-foreground">{s.email}</TD>
                  <TD>{s.resellerProfile?.brandName || "—"}</TD>
                  <TD>{s.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="danger">Inativo</Badge>}</TD>
                  <TD className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</TD>
                </TR>
              ))}
              {subs.length === 0 && <TR><TD colSpan={5} className="text-center text-muted-foreground py-12">Você ainda não tem subrevendedores.</TD></TR>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
