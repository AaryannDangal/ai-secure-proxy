import { useEffect, useState } from "react";
import { api, Stats } from "../api";

export default function Overview({ apiKey }: { apiKey: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .stats(apiKey)
      .then(setStats)
      .catch((e) => setError(e.message));
  }, [apiKey]);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p className="muted">Loading…</p>;

  const pct = Math.min(
    100,
    Math.round((stats.requestsUsed / Math.max(1, stats.requestsLimit)) * 100)
  );

  return (
    <div className="stack">
      <div className="cards">
        <Stat label="Total scans" value={stats.total} tone="neutral" />
        <Stat label="Blocked" value={stats.blocked} tone="danger" />
        <Stat label="Flagged" value={stats.flagged} tone="warn" />
        <Stat label="Safe" value={stats.safe} tone="good" />
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Usage</h2>
          <span className="pill">{stats.plan} plan</span>
        </div>
        <div className="usage-row">
          <span>
            {stats.requestsUsed.toLocaleString()} /{" "}
            {stats.requestsLimit.toLocaleString()} requests
          </span>
          <span className="muted">{pct}%</span>
        </div>
        <div className="bar">
          <div
            className={`bar-fill ${pct > 90 ? "danger" : pct > 70 ? "warn" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="hint">
          Blocked requests never reach your upstream model, so you can enforce
          policy before paying for tokens.
        </p>
      </section>

      <section className="panel">
        <h2>Threat mix</h2>
        {stats.total === 0 ? (
          <p className="muted">No scans yet. Try the Playground tab.</p>
        ) : (
          <div className="mix">
            <MixBar label="Safe" value={stats.safe} total={stats.total} tone="good" />
            <MixBar label="Flagged" value={stats.flagged} total={stats.total} tone="warn" />
            <MixBar label="Blocked" value={stats.blocked} total={stats.total} tone="danger" />
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "good" | "warn" | "danger";
}) {
  return (
    <div className={`stat ${tone}`}>
      <span className="stat-value">{value.toLocaleString()}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function MixBar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mix-row">
      <span className="mix-label">{label}</span>
      <div className="bar">
        <div className={`bar-fill ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="mix-value">{value}</span>
    </div>
  );
}
