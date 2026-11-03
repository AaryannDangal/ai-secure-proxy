import { Router } from "express";
import { z } from "zod";
import { requireApiKey } from "../middleware/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

const ruleSchema = z.object({
  pattern: z.string().min(1).max(500),
  isRegex: z.boolean().optional().default(false),
});

// List all block rules for the authenticated customer
router.get("/", requireApiKey, async (req, res) => {
  const customer = (req as any).customer;

  const rules = await prisma.blockRule.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
  });

  res.json({ rules, count: rules.length });
});

// Create a block rule
router.post("/", requireApiKey, async (req, res) => {
  const customer = (req as any).customer;
  const parse = ruleSchema.safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({ error: "Invalid rule. Provide { pattern, isRegex? }" });
    return;
  }

  const { pattern, isRegex } = parse.data;

  // Validate regex up-front so a bad rule can't be stored
  if (isRegex) {
    try {
      new RegExp(pattern);
    } catch {
      res.status(400).json({ error: "Invalid regular expression" });
      return;
    }
  }

  const rule = await prisma.blockRule.create({
    data: {
      customerId: customer.id,
      pattern,
      isRegex,
    },
  });

  res.status(201).json({ rule });
});

// Toggle a rule on/off
router.patch("/:id", requireApiKey, async (req, res) => {
  const customer = (req as any).customer;
  const { id } = req.params;
  const isActive = !!req.body?.isActive;

  const existing = await prisma.blockRule.findFirst({
    where: { id, customerId: customer.id },
  });

  if (!existing) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }

  const rule = await prisma.blockRule.update({
    where: { id },
    data: { isActive },
  });

  res.json({ rule });
});

// Delete a rule
router.delete("/:id", requireApiKey, async (req, res) => {
  const customer = (req as any).customer;
  const { id } = req.params;

  const existing = await prisma.blockRule.findFirst({
    where: { id, customerId: customer.id },
  });

  if (!existing) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }

  await prisma.blockRule.delete({ where: { id } });
  res.json({ deleted: true });
});

export default router;
