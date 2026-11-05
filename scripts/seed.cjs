/**
 * Creates (or refreshes) a customer and prints its API key.
 *
 *   npm run seed                     → dev@example.com, free plan
 *   npm run seed -- you@x.com pro    → that email, pro plan
 *
 * Plain CommonJS on purpose: it runs with `node` on a production host, where
 * `tsx` (a dev dependency) may not be installed.
 */
const { PrismaClient } = require("@prisma/client");
const crypto = require("node:crypto");

const prisma = new PrismaClient();

const LIMITS = {
  free: 1000,
  starter: 10000,
  pro: 50000,
};

async function main() {
  const email = process.argv[2] || "dev@example.com";
  const plan = process.argv[3] || "free";

  const customer = await prisma.customer.upsert({
    where: { email },
    update: { plan, requestsLimit: LIMITS[plan] ?? 1000 },
    create: {
      email,
      apiKey: `sk-${crypto.randomBytes(24).toString("hex")}`,
      plan,
      requestsLimit: LIMITS[plan] ?? 1000,
    },
  });

  console.log("Customer ready:");
  console.log(`  email: ${customer.email}`);
  console.log(`  plan:  ${customer.plan}`);
  console.log(`  key:   ${customer.apiKey}`);
  console.log("\nPaste this key into the dashboard's connect screen.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
