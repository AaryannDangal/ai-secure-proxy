const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface Stats {
  total: number;
  blocked: number;
  flagged: number;
  safe: number;
  requestsUsed: number;
  requestsLimit: number;
  plan: string;
}

export interface Scan {
  id: string;
  prompt: string | null;
  hasImage: boolean;
  language: string | null;
  verdict: "safe" | "blocked" | "flagged";
  reason: string | null;
  riskScore: number;
  createdAt: string;
}

export interface BlockRule {
  id: string;
  pattern: string;
  isRegex: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ScanResponse {
  blocked: boolean;
  verdict: string;
  reason?: string;
  riskScore: number;
  language?: string;
  response?: unknown;
  error?: string;
}

async function request<T>(
  path: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as any).error || `Request failed (${res.status})`);
  }

  return data as T;
}

export const api = {
  stats: (key: string) => request<Stats>("/v1/scans/stats", key),

  scans: (key: string, limit = 100) =>
    request<{ scans: Scan[]; count: number }>(`/v1/scans?limit=${limit}`, key),

  rules: (key: string) =>
    request<{ rules: BlockRule[]; count: number }>("/v1/config/rules", key),

  addRule: (key: string, pattern: string, isRegex: boolean) =>
    request<{ rule: BlockRule }>("/v1/config/rules", key, {
      method: "POST",
      body: JSON.stringify({ pattern, isRegex }),
    }),

  toggleRule: (key: string, id: string, isActive: boolean) =>
    request<{ rule: BlockRule }>(`/v1/config/rules/${id}`, key, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }),

  deleteRule: (key: string, id: string) =>
    request<{ deleted: boolean }>(`/v1/config/rules/${id}`, key, {
      method: "DELETE",
    }),

  scan: async (key: string, prompt: string): Promise<ScanResponse> => {
    const res = await fetch(`${BASE}/v1/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
      },
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json().catch(() => ({}));

    // 403 = blocked. That's a valid scan result, not a failure.
    if (res.ok || res.status === 403) {
      return data as ScanResponse;
    }

    throw new Error((data as any).error || `Request failed (${res.status})`);
  },
};
