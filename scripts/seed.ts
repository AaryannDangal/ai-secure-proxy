import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || "dev@example.com";
  const plan = process.argv[3] || "free";

  const limits: Record<string, number> = {
    free: 1000,
    starter: 10000,
    pro: 50000,
  };

  const apiKey = `sk-${crypto.randomBytes(24).toString("hex")}`;

  const customer = await prisma.customer.upsert({
    where: { email },
    update: { plan, requestsLimit: limits[plan] ?? 1000 },
    create: {
      email,
      apiKey,
      plan,
      requestsLimit: limits[plan] ?? 1000,
    },
  });

  console.log("Customer ready:");
  console.log(`  email: ${customer.email}`);
  console.log(`  plan:  ${customer.plan}`);
  console.log(`  key:   ${customer.apiKey}`);
  console.log("\nPaste this key into the dashboard:");
  console.log("  cd frontend && npm run dev  →  http://localhost:5173");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
