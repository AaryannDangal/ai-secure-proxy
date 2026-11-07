import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { scanMessages, worstSegment, Message } from "../services/segments";

/**
 * Public demo endpoint.
 *
 * The rule for this route is that it must be safe to expose to the internet:
 *   - no API key, because a key in a public bundle is not a secret
 *   - no upstream call, so a visitor can never spend the operator's tokens
 *   - no database writes, so it cannot pollute or grow the real audit log
 *   - input caps, so one request cannot hold the process hostage
 *
 * Everything it does is CPU-only: normalise, match, score, return a verdict.
 */
const router = Router();

// Tighter than the global limiter: this one is the public door.
const demoLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demo limit reached. Try again in a few minutes." },
});

// The demo is meant for a handful of messages; a real integration uses /v1/scan.
const MAX_TOTAL_CHARS = 4000;
const MAX_MESSAGES = 10;

const messageSchema = z.object({
  role: z.string().min(1).max(20),
  content: z.string().max(MAX_TOTAL_CHARS),
});

const demoSchema = z
  .object({
    prompt: z.string().min(1).max(MAX_TOTAL_CHARS).optional(),
    messages: z.array(messageSchema).min(1).max(MAX_MESSAGES).optional(),
  })
  .refine((data) => data.prompt !== undefined || data.messages !== undefined, {
    message: "Provide either prompt or messages",
  })
  .refine(
    (data) => {
      const chars =
        data.prompt?.length ??
        data.messages?.reduce((sum, m) => sum + m.content.length, 0) ??
        0;
      return chars <= MAX_TOTAL_CHARS;
    },
    { message: `Input must be ${MAX_TOTAL_CHARS} characters or fewer` }
  );

router.post("/scan", demoLimiter, async (req, res) => {
  const parse = demoSchema.safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({
      error: parse.error.issues[0]?.message || "Invalid request body",
    });
    return;
  }

  const messages: Message[] =
    parse.data.messages ?? [{ role: "user", content: parse.data.prompt ?? "" }];

  // No customer rules and the default threshold: the demo shows the built-in
  // detection only, exactly as a new account would experience it.
  const segments = await scanMessages(messages, [], 60);
  const worst = worstSegment(segments);

  res.json({
    demo: true,
    stored: false,
    blocked: worst?.verdict === "blocked",
    verdict: worst?.verdict ?? "safe",
    reason: worst?.reason,
    riskScore: worst?.riskScore ?? 0,
    language: worst?.language,
    blockThreshold: 60,
    blockedRole:
      worst?.verdict === "blocked" ? worst?.role ?? null : null,
    segments: segments.map((s) => ({
      index: s.index,
      role: s.role,
      trust: s.trust,
      threshold: s.threshold,
      verdict: s.verdict,
      riskScore: s.riskScore,
      reason: s.reason,
    })),
  });
});

export default router;
