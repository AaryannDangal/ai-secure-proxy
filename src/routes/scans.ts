import { Router } from "express";
import { requireApiKey } from "../middleware/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

router.get("/", requireApiKey, async (req, res) => {
  const customer = (req as any).customer;
  const limit = parseInt(req.query.limit as string) || 50;

  const scans = await prisma.scan.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  res.json({ scans, count: scans.length });
});

router.get("/stats", requireApiKey, async (req, res) => {
  const customer = (req as any).customer;

  const total = await prisma.scan.count({
    where: { customerId: customer.id },
  });

  const blocked = await prisma.scan.count({
    where: { customerId: customer.id, verdict: "blocked" },
  });

  const flagged = await prisma.scan.count({
    where: { customerId: customer.id, verdict: "flagged" },
  });

  res.json({
    total,
    blocked,
    flagged,
    safe: total - blocked - flagged,
    requestsUsed: customer.requestsUsed,
    requestsLimit: customer.requestsLimit,
    plan: customer.plan,
  });
});

export default router;
