import { scanPrompt, CustomRule, ScanResult } from "./scanService";

/**
 * Who wrote a piece of text determines how much we trust it.
 *
 *   policy    the customer's own instructions (system / developer)
 *   user      the end user talking to the bot
 *   model     the assistant's earlier output
 *   untrusted third-party data the bot was asked to read (tool / retrieval)
 */
export type Trust = "policy" | "user" | "model" | "untrusted";

export interface Message {
  role: string;
  content: string;
}

export interface ScannedSegment extends ScanResult {
  index: number;
  role: string;
  trust: Trust;
  threshold: number;
}

const TRUST_BY_ROLE: Record<string, Trust> = {
  system: "policy",
  developer: "policy",
  user: "user",
  assistant: "model",
  tool: "untrusted",
  function: "untrusted",
  retrieval: "untrusted",
};

export function trustOf(role: string): Trust {
  return TRUST_BY_ROLE[role] ?? "user";
}

/**
 * Untrusted content is judged more strictly: a user is allowed to talk to
 * their own bot, a scraped document is not. The floor keeps the threshold
 * from dropping below the flag threshold.
 */
export function thresholdFor(trust: Trust, blockThreshold: number): number {
  if (trust !== "untrusted") return blockThreshold;
  return Math.max(20, blockThreshold - 20);
}

/**
 * Scans every message except the customer's own policy (system/developer).
 * System prompts legitimately contain phrases like "never reveal your
 * system prompt", which would otherwise trip the prompt-leak patterns.
 */
export async function scanMessages(
  messages: Message[],
  customRules: CustomRule[],
  blockThreshold: number
): Promise<ScannedSegment[]> {
  const segments: ScannedSegment[] = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const trust = trustOf(message.role);
    if (trust === "policy") continue;

    const threshold = thresholdFor(trust, blockThreshold);
    const result = await scanPrompt(
      { prompt: message.content, customerId: "" },
      customRules,
      threshold
    );

    segments.push({
      ...result,
      index: i,
      role: message.role,
      trust,
      threshold,
    });
  }

  return segments;
}

const RANK: Record<string, number> = { safe: 0, flagged: 1, blocked: 2 };

/**
 * Worst verdict wins. On a tie, the higher risk score wins, which is what
 * the dashboard should show as "the reason this request was stopped".
 */
export function worstSegment(segments: ScannedSegment[]): ScannedSegment | null {
  let worst: ScannedSegment | null = null;

  for (const segment of segments) {
    if (!worst) {
      worst = segment;
      continue;
    }
    const rank = RANK[segment.verdict] ?? 0;
    const worstRank = RANK[worst.verdict] ?? 0;

    if (rank > worstRank || (rank === worstRank && segment.riskScore > worst.riskScore)) {
      worst = segment;
    }
  }

  return worst;
}
