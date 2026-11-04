import { useEffect, useState } from "react";
import { api, ThresholdConfig } from "../api";

export default function Settings({ apiKey }: { apiKey: string }) {
  const [config, setConfig] = useState<ThresholdConfig | null>(null);
  const [draft, setDraft] = useState(60);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .threshold(apiKey)
      .then((c) => {
        setConfig(c);
        setDraft(c.blockThreshold);
      })
      .catch((e) => setError(e.message));
  }, [apiKey]);

  if (error) return <p className="error">{error}</p>;
  if (!config) return <p className="muted">Loading…</p>;

  const dirty = draft !== config.blockThreshold;

  async function save() {
    setBusy(true);
    setError("");
    try {
      const updated = await api.setThreshold(apiKey, draft);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // What would happen to a known "high" (40) prompt at this threshold?
  const highBlocks = 40 >= draft;
  const criticalBlocks = 60 >= draft;
  const everythingBlocks = 20 >= draft;

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-head">
          <h2>Block threshold</h2>
          <span className="pill">{draft}</span>
        </div>

        <p className="hint">
          The risk score at which a prompt is refused instead of answered. Lower
          is stricter. Custom rules always block regardless of this value.
        </p>

        <input
          className="slider"
          type="range"
          min={config.min}
          max={config.max}
          step={1}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
        />

        <div className="slider-scale">
          <span>{config.min}</span>
          <span className="muted">flag ≥ {config.flagThreshold}</span>
          <span>{config.max}</span>
        </div>

        <div className="threshold-preview">
          <div className={criticalBlocks ? "on" : "off"}>
            <strong>Critical patterns</strong> (60){" "}
            {criticalBlocks ? "block alone" : "will not block alone"}
          </div>
          <div className={highBlocks ? "on" : "off"}>
            <strong>High patterns</strong> (40){" "}
            {highBlocks ? "block alone" : "only flag"}
          </div>
          <div className={everythingBlocks ? "on danger" : "off"}>
            <strong>Medium patterns</strong> (20){" "}
            {everythingBlocks ? "block alone — very strict" : "only flag"}
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="save-row">
          <button className="btn primary" onClick={save} disabled={busy || !dirty}>
            {busy ? "Saving…" : dirty ? "Save threshold" : "Saved"}
          </button>
          {saved && <span className="saved-flash">Saved ✓</span>}
          {dirty && (
            <button
              className="btn ghost"
              onClick={() => setDraft(config.blockThreshold)}
            >
              Reset
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>What this means</h2>
        <table>
          <thead>
            <tr>
              <th>Prompt kind</th>
              <th>Risk</th>
              <th>Verdict now</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Explicit jailbreak with AI context</td>
              <td>60–100</td>
              <td>
                <span className="badge blocked">blocked</span>
              </td>
            </tr>
            <tr>
              <td>Ambiguous bypass phrasing</td>
              <td>40</td>
              <td>
                <span className={`badge ${highBlocks ? "blocked" : "flagged"}`}>
                  {highBlocks ? "blocked" : "flagged"}
                </span>
              </td>
            </tr>
            <tr>
              <td>Mild signal ("developer mode")</td>
              <td>20</td>
              <td>
                <span className={`badge ${everythingBlocks ? "blocked" : "flagged"}`}>
                  {everythingBlocks ? "blocked" : "flagged"}
                </span>
              </td>
            </tr>
            <tr>
              <td>Normal question</td>
              <td>0</td>
              <td>
                <span className="badge safe">safe</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
