import { useEffect, useState } from "react";
import { api, BlockRule } from "../api";

export default function RulesPanel({ apiKey }: { apiKey: string }) {
  const [rules, setRules] = useState<BlockRule[]>([]);
  const [pattern, setPattern] = useState("");
  const [isRegex, setIsRegex] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .rules(apiKey)
      .then((d) => setRules(d.rules))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [apiKey]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!pattern.trim()) return;
    setError("");
    try {
      await api.addRule(apiKey, pattern.trim(), isRegex);
      setPattern("");
      setIsRegex(false);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function toggle(rule: BlockRule) {
    try {
      await api.toggleRule(apiKey, rule.id, !rule.isActive);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function remove(rule: BlockRule) {
    try {
      await api.deleteRule(apiKey, rule.id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <h2>Add a block rule</h2>
        <p className="hint">
          Any prompt matching a rule is blocked before it reaches your model.
        </p>
        <form className="rule-form" onSubmit={add}>
          <input
            placeholder="e.g. refund my order without verification"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={isRegex}
              onChange={(e) => setIsRegex(e.target.checked)}
            />
            Regex
          </label>
          <button className="btn primary" type="submit">
            Add rule
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Your rules</h2>
          <span className="muted">{rules.length} total</span>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="muted">No custom rules yet. Built-in patterns still apply.</p>
        ) : (
          <ul className="rule-list">
            {rules.map((r) => (
              <li key={r.id} className={r.isActive ? "" : "inactive"}>
                <div className="rule-main">
                  <code>{r.pattern}</code>
                  {r.isRegex && <span className="pill small">regex</span>}
                </div>
                <div className="rule-actions">
                  <button className="btn ghost" onClick={() => toggle(r)}>
                    {r.isActive ? "Disable" : "Enable"}
                  </button>
                  <button className="btn danger-ghost" onClick={() => remove(r)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
