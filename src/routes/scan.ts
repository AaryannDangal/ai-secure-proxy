import { Router } from "express";
import { z } from "zod";
import { requireApiKey, incrementUsage } from "../middleware/auth";
import { scanPrompt, scanImage, ScanResult } from "../services/scanService";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

const scanSchema = z.object({
  prompt: z.string().optional(),
  image: z.string().optional(),
});

router.post("/", requireApiKey, async (req, res) => {
  const parse = scanSchema.safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { prompt, image } = parse.data;
  const customer = (req as any).customer;

  // Load customer-defined block rules
  const dbRules = await prisma.blockRule.findMany({
    where: { customerId: customer.id, isActive: true },
  });

  const customRules = dbRules.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    isRegex: r.isRegex,
  }));

  // Scan text using the customer's own block threshold
  const textResult = await scanPrompt(
    { prompt, image, customerId: customer.id },
    customRules,
    customer.blockThreshold
  );

  // Scan image (placeholder)
  const imageResult = scanImage(!!image);

  // Combine results: worst verdict wins
  const verdictRank: Record<string, number> = { safe: 0, flagged: 1, blocked: 2 };
  const combinedVerdict =
    verdictRank[imageResult.verdict] > verdictRank[textResult.verdict]
      ? imageResult.verdict
      : textResult.verdict;

  const combinedRiskScore = Math.max(textResult.riskScore, imageResult.riskScore);
  const combinedReason =
    textResult.reason || imageResult.reason || undefined;

  const result: ScanResult = {
    verdict: combinedVerdict,
    reason: combinedReason,
    riskScore: combinedRiskScore,
    language: textResult.language,
    blockedPatterns: textResult.blockedPatterns,
  };

  // Save scan log
  await prisma.scan.create({
    data: {
      customerId: customer.id,
      prompt,
      hasImage: !!image,
      language: result.language,
      verdict: result.verdict,
      reason: result.reason,
      riskScore: result.riskScore,
    },
  });

  // Increment usage
  await incrementUsage(customer.id);

  // If blocked, do NOT forward to upstream AI
  if (result.verdict === "blocked") {
    res.status(403).json({
      blocked: true,
      verdict: result.verdict,
      reason: result.reason,
      riskScore: result.riskScore,
      language: result.language,
      blockThreshold: customer.blockThreshold,
    });
    return;
  }

  // Safe or flagged: forward to upstream AI (your gemini-web2api)
  try {
    const upstreamUrl = process.env.UPSTREAM_AI_URL || "http://localhost:8081";

    const upstreamResponse = await fetch(`${upstreamUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-3.5-flash",
        messages: prompt ? [{ role: "user", content: prompt }] : [],
      }),
    });

    const upstreamData = await upstreamResponse.json();

    res.json({
      blocked: false,
      verdict: result.verdict,
      reason: result.reason,
      riskScore: result.riskScore,
      language: result.language,
      blockThreshold: customer.blockThreshold,
      response: upstreamData,
    });
  } catch (error) {
    // The scan succeeded; only the upstream AI call failed.
    // Return the scan result anyway so the caller can act on the verdict.
    console.error("Upstream AI failed:", error);

    res.status(200).json({
      blocked: false,
      verdict: result.verdict,
      reason: result.reason,
      riskScore: result.riskScore,
      language: result.language,
      blockThreshold: customer.blockThreshold,
      response: null,
      upstreamError: "Upstream AI unavailable",
    });

  }
});

export default router;
