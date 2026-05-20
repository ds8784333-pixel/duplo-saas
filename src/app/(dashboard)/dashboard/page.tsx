import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { StatsCard } from "@/components/stats-card";
import { brl } from "@/lib/utils";
import { DashboardRealtime } from "./realtime";

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;

  // se for ADMIN, conta tudo; senão filtra por hierarquia
  const isAdmin = user.role === "ADMIN";
  const childrenIds = isAdmin
    ? undefined
    : await db.user.findMany({ where: { resellerId: user.id }, select: { id: true } }).then((r) => r.map((x) => x.id));

  const now = new Date();
  const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [active, expiringWeek, wallet, pendingCommissions] = await Promise.all([
    db.subscription.count({
      where: {
        status: "ACTIVE",
        expiresAt: { gt: now },
        ...(childrenIds ? { userId: { in: childrenIds } } : {}),
      },
    }),
    db.subscription.count({
      where: {
        status: "ACTIVE",
        expiresAt: { gt: now, lte: weekAhead },
        ...(childrenIds ? { userId: { in: childrenIds } } : {}),
      },
    }),
    db.wallet.findUnique({ where: { userId: user.id } }),
    db.commission.aggregate({ where: { earnerId: user.id, paid: false }, _sum: { amount: true } }),
  ]);

  const totalIn = Number(wallet?.totalIn || 0);
  const totalOut = Number(wallet?.totalOut || 0);
  const balance = Number(wallet?.balance || 0);
  const commPending = Number(pendingCommissions._sum.amount || 0);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{user.resellerProfile?.brandName || user.name}</p>
        </div>
      </header>

      <DashboardRealtime userId={user.id} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Usuários ativos" value={active} color="emerald" />
        <StatsCard label="Expirando essa semana" value={expiringWeek} color="amber" />
        <StatsCard label="Saldo da carteira" value={brl(balance)} color="cyan" />
        <StatsCard label="Comissão pendente" value={brl(commPending)} color="violet" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard label="Entradas (total)" value={brl(totalIn)} color="emerald" />
        <StatsCard label="Saídas (total)" value={brl(totalOut)} color="rose" />
      </div>
    </div>
  );
}
