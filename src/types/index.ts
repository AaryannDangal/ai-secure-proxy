export type Verdict = "safe" | "blocked" | "flagged";

export interface ScanRequest {
  prompt?: string;
  image?: string; // base64 or URL
  customerId?: string;
}

export interface ScanResult {
  verdict: Verdict;
  reason?: string;
  riskScore: number;
  language?: string;
  blockedPatterns?: string[];
}

export interface JailbreakPattern {
  id: string;
  pattern: string | RegExp;
  isRegex: boolean;
  language: string; // "en", "de", "ne", "all"
  severity: "low" | "medium" | "high";
  description: string;
}
