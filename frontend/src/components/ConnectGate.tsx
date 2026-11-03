import { useState } from "react";

interface Props {
  onConnect: (key: string) => void;
}

export default function ConnectGate({ onConnect }: Props) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Enter your API key to continue.");
      return;
    }
    onConnect(trimmed);
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="logo-row">
          <div className="logo-mark">S</div>
          <div>
            <h1>AI-Secure Proxy</h1>
            <p className="muted">Jailbreak detection for your AI app</p>
          </div>
        </div>

        <form onSubmit={submit}>
          <label htmlFor="apiKey">API key</label>
          <input
            id="apiKey"
            type="password"
            placeholder="sk-..."
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setError("");
            }}
            autoFocus
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary full">
            Connect to dashboard
          </button>
        </form>

        <p className="hint">
          Your key stays in this browser (localStorage). Create one in your
          database with <code>npm run seed</code>.
        </p>
      </div>
    </div>
  );
}
