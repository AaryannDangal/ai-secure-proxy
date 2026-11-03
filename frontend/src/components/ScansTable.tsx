import { useEffect, useState } from "react";
import { api, Scan } from "../api";

export default function ScansTable({ apiKey }: { apiKey: string }) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .scans(apiKey)
      .then((d) => setScans(d.scans))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [apiKey]);

  if (error) return <p className="error">{error}</p>;
  if (loading) return <p className="muted">Loading…</p>;

  if (scans.length === 0) {
    return (
      <div className="panel empty">
        <h2>No scans yet</h2>
        <p className="muted">
          Send a request to <code>POST /v1/scan</code> or try the Playground.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Scan log</h2>
        <span className="muted">{scans.length} recent</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Verdict</th>
              <th>Risk</th>
              <th>Lang</th>
              <th>Prompt</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((s) => (
              <tr key={s.id}>
                <td className="nowrap muted">
                  {new Date(s.createdAt).toLocaleString()}
                </td>
                <td>
                  <span className={`badge ${s.verdict}`}>{s.verdict}</span>
                </td>
                <td>{s.riskScore}</td>
                <td className="muted">{s.language || "—"}</td>
                <td className="prompt-cell" title={s.prompt || ""}>
                  {s.prompt || (s.hasImage ? "[image]" : "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
