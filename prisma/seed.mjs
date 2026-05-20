// Seed inicial: cria 1 admin + 1 plano padrão.
// Use: npx prisma db seed
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const db = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const plan = await db.plan.upsert({
    where: { id: "plan-default" },
    create: { id: "plan-default", name: "Pro", description: "Plano padrão", pricePerDay: 0.6, maxUsers: 0 },
    update: {},
  });

  const admin = await db.user.upsert({
    where: { email: "admin@duplo.local" },
    create: {
      email: "admin@duplo.local",
      passwordHash: hashPassword("admin123"),
      name: "Admin",
      role: "ADMIN",
      wallet: { create: {} },
    },
    update: {},
  });

  console.log("seed OK:", { plan: plan.id, admin: admin.email, password: "admin123" });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
