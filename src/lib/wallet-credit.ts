// Crédito atômico de depósito Pix na carteira.
// Usado tanto pelo webhook (POST /api/webhooks/payment) quanto pelo polling
// do front (GET /api/deposits/[id]). Idempotente — só credita uma vez.
import { db } from "./db";
import { publish } from "./ws-publish";

const MP_STATUS_MAP: Record<string, string> = {
  approved: "APPROVED",
  pending: "PENDING",
  in_process: "PENDING",
  rejected: "REJECTED",
  cancelled: "CANCELLED",
  refunded: "REJECTED",
  charged_back: "REJECTED",
};

export async function creditDepositIfApproved(depositId: string, mpStatus: string) {
  const mapped = MP_STATUS_MAP[mpStatus] || "PENDING";

  // tx atômica: re-lê o depósito e só credita se ainda não foi creditado.
  return db.$transaction(async (tx) => {
    const dep = await tx.deposit.findUnique({ where: { id: depositId } });
    if (!dep) return { ok: false, reason: "not-found" as const };
    if (dep.creditedAt) return { ok: true, reason: "already-credited" as const };

    if (mapped !== "APPROVED") {
      if (dep.status !== mapped) {
        await tx.deposit.update({ where: { id: depositId }, data: { status: mapped } });
      }
      return { ok: false, reason: "not-approved" as const, status: mapped };
    }

    const wallet = await tx.wallet.upsert({
      where: { userId: dep.userId },
      create: { userId: dep.userId },
      update: {},
    });
    const balanceAfter = Number(wallet.balance) + Number(dep.amount);

    await tx.wallet.update({
      where: { userId: dep.userId },
      data: { balance: balanceAfter, totalIn: { increment: Number(dep.amount) } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "DEPOSIT",
        amount: Number(dep.amount),
        balanceAfter,
        description: `Depósito PIX · ${dep.providerId || dep.id}`,
        refId: dep.id,
      },
    });
    await tx.deposit.update({
      where: { id: depositId },
      data: { status: "APPROVED", creditedAt: new Date() },
    });

    // publish fora da transação seria mais correto, mas o publish atual só
    // empurra ws — falha não compromete consistência.
    await publish("wallet:" + dep.userId, {
      type: "wallet.updated",
      message: "Depósito aprovado",
    });

    return { ok: true, reason: "credited" as const, userId: dep.userId };
  });
}
