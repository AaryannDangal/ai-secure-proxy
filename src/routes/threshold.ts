import { Router } from "express";
import { z } from "zod";
import { requireApiKey } from "../middleware/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/**
 * The block threshold is the risk score at which a prompt is refused.
 * Lower = stricter (more blocks, more false positives).
 * Higher = looser (fewer blocks, more attacks get through).
 *
 * The flag threshold is fixed at 20 for now: below the block threshold but
 * still worth logging. It is intentionally not customer-configurable yet.
 */
const MIN_THRESHOLD = 10;
const MAX_THRESHOLD = 100;
const FLAG_THRESHOLD = 20;

const thresholdSchema = z.object({
  blockThreshold: z.number().int().min(MIN_THRESHOLD).max(MAX_THRESHOLD),
});

// Read the current threshold
router.get("/", requireApiKey, (req, res) => {
  const customer = (req as any).customer;

  res.json({
    blockThreshold: customer.blockThreshold,
    flagThreshold: FLAG_THRESHOLD,
    min: MIN_THRESHOLD,
    max: MAX_THRESHOLD,
  });
});

// Update the threshold
router.patch("/", requireApiKey, async (req, res) => {
  const customer = (req as any).customer;
  const parse = thresholdSchema.safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({
      error: `blockThreshold must be an integer between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}`,
    });
    return;
  }

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: { blockThreshold: parse.data.blockThreshold },
  });

  res.json({
    blockThreshold: updated.blockThreshold,
    flagThreshold: FLAG_THRESHOLD,
    min: MIN_THRESHOLD,
    max: MAX_THRESHOLD,
  });
});

export default router;
