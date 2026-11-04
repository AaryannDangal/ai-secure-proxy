import { useEffect, useState } from "react";
import ConnectGate from "./components/ConnectGate";
import Overview from "./components/Overview";
import ScansTable from "./components/ScansTable";
import RulesPanel from "./components/RulesPanel";
import Playground from "./components/Playground";
import Settings from "./components/Settings";

type Tab = "overview" | "scans" | "rules" | "playground" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "scans", label: "Scans" },
  { id: "rules", label: "Rules" },
  { id: "playground", label: "Playground" },
  { id: "settings", label: "Settings" },
];

const STORAGE_KEY = "ai-secure-proxy-key";

export default function App() {
  const [apiKey, setApiKey] = useState<string>(() =>
    localStorage.getItem(STORAGE_KEY) || ""
  );
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (apiKey) localStorage.setItem(STORAGE_KEY, apiKey);
  }, [apiKey]);

  function disconnect() {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey("");
  }

  if (!apiKey) {
    return <ConnectGate onConnect={setApiKey} />;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo-row small">
          <div className="logo-mark">S</div>
          <div>
            <strong>AI-Secure Proxy</strong>
            <p className="muted tiny">Dashboard</p>
          </div>
        </div>

        <nav>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "nav-item active" : "nav-item"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <button className="btn ghost full" onClick={disconnect}>
          Disconnect
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>{TABS.find((t) => t.id === tab)?.label}</h1>
          <span className="muted tiny">
            key: {apiKey.slice(0, 6)}…{apiKey.slice(-4)}
          </span>
        </header>

        {tab === "overview" && <Overview apiKey={apiKey} />}
        {tab === "scans" && <ScansTable apiKey={apiKey} />}
        {tab === "rules" && <RulesPanel apiKey={apiKey} />}
        {tab === "playground" && <Playground apiKey={apiKey} />}
        {tab === "settings" && <Settings apiKey={apiKey} />}
      </main>
    </div>
  );
}
