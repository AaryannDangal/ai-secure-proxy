import { Router } from "express";
import { z } from "zod";
import { requireApiKey, incrementUsage } from "../middleware/auth";
import { scanImage, ScanResult } from "../services/scanService";
import { scanMessages, worstSegment, Message } from "../services/segments";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

const messageSchema = z.object({
  role: z.string().min(1),
  content: z.string(),
});

const scanSchema = z
  .object({
    prompt: z.string().optional(),
    messages: z.array(messageSchema).min(1).max(50).optional(),
    image: z.string().optional(),
  })
  .refine((data) => data.prompt !== undefined || data.messages !== undefined, {
    message: "Provide either prompt or messages",
  });

router.post("/", requireApiKey, async (req, res) => {
  const parse = scanSchema.safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { prompt, image } = parse.data;
  const customer = (req as any).customer;

  // `prompt` stays supported for existing clients; messages are the new shape.
  const messages: Message[] =
    parse.data.messages ?? [{ role: "user", content: prompt ?? "" }];

  // Load customer-defined block rules
  const dbRules = await prisma.blockRule.findMany({
    where: { customerId: customer.id, isActive: true },
  });

  const customRules = dbRules.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    isRegex: r.isRegex,
  }));

  // Scan every message except the customer's own policy (system/developer)
  const segments = await scanMessages(
    messages,
    customRules,
    customer.blockThreshold
  );

  const textResult = worstSegment(segments);

  const result: ScanResult = {
    verdict: textResult?.verdict ?? "safe",
    reason: textResult?.reason,
    riskScore: textResult?.riskScore ?? 0,
    language: textResult?.language,
    blockedPatterns: textResult?.blockedPatterns ?? [],
  };

  // Scan image (placeholder)
  const imageResult = scanImage(!!image);

  // Combine results: worst verdict wins
  const verdictRank: Record<string, number> = { safe: 0, flagged: 1, blocked: 2 };
  const combinedVerdict =
    verdictRank[imageResult.verdict] > verdictRank[result.verdict]
      ? imageResult.verdict
      : result.verdict;

  const combinedRiskScore = Math.max(result.riskScore, imageResult.riskScore);
  const combinedReason = result.reason || imageResult.reason || undefined;
  const blockedRole =
    combinedVerdict === "blocked" ? textResult?.role ?? null : null;

  // Save scan log (the last user message keeps the dashboard readable)
  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  await prisma.scan.create({
    data: {
      customerId: customer.id,
      prompt: lastUser?.content ?? messages[0]?.content,
      hasImage: !!image,
      messageCount: messages.length,
      blockedRole,
      language: result.language,
      verdict: combinedVerdict,
      reason: combinedReason,
      riskScore: combinedRiskScore,
    },
  });

  // Increment usage
  await incrementUsage(customer.id);

  const summary = {
    blocked: combinedVerdict === "blocked",
    verdict: combinedVerdict,
    reason: combinedReason,
    riskScore: combinedRiskScore,
    language: result.language,
    blockThreshold: customer.blockThreshold,
    blockedRole: blockedRole ?? undefined,
    segments: segments.map((s) => ({
      index: s.index,
      role: s.role,
      trust: s.trust,
      threshold: s.threshold,
      verdict: s.verdict,
      riskScore: s.riskScore,
      reason: s.reason,
    })),
  };

  // If blocked, do NOT forward to upstream AI
  if (combinedVerdict === "blocked") {
    res.status(403).json(summary);
    return;
  }

  // Safe or flagged: forward to upstream AI
  try {
    const upstreamUrl = process.env.UPSTREAM_AI_URL || "http://localhost:8081";

    const upstreamResponse = await fetch(`${upstreamUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-3.5-flash",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    const upstreamData = await upstreamResponse.json();

    res.json({
      ...summary,
      response: upstreamData,
    });
  } catch (error) {
    // The scan succeeded; only the upstream AI call failed.
    console.error("Upstream AI failed:", error);

    res.status(200).json({
      ...summary,
      response: null,
      upstreamError: "Upstream AI unavailable",
    });
  }
});

export default router;
