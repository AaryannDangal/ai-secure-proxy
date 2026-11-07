import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import scanRoute from "./routes/scan";
import scansRoute from "./routes/scans";
import rulesRoute from "./routes/rules";
import thresholdRoute from "./routes/threshold";
import demoRoute from "./routes/demo";
import { warmUp } from "./services/semantic";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Render (and every other PaaS) terminates TLS in front of the app, so the
// client IP arrives in X-Forwarded-For. Without this, rate limiting sees one
// IP for every visitor.
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());

// In production the dashboard lives on another origin, so it must be allowed
// explicitly. Comma-separated to support a custom domain later.
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
  })
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  })
);

// Body parsing
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ai-secure-proxy" });
});

// Routes
app.use("/v1/scan", scanRoute);
app.use("/v1/demo", demoRoute);
app.use("/v1/scans", scansRoute);
app.use("/v1/config/rules", rulesRoute);
app.use("/v1/config/threshold", thresholdRoute);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(PORT, () => {
  console.log(`AI-Secure Proxy running on http://localhost:${PORT}`);

  // The embedding model is ~150 MB and needs ~8 s to load. That does not fit a
  // small production instance, so it can be switched off with
  // SEMANTIC_ENABLED=false — the other four layers keep working.
  if (process.env.SEMANTIC_ENABLED === "false") {
    console.log("Semantic layer disabled (SEMANTIC_ENABLED=false)");
    return;
  }

  // Load the embedding model in the background so the first scan is not slow.
  warmUp()
    .then(() => console.log("Semantic layer ready"))
    .catch((error) => console.error("Semantic layer unavailable:", error));
});
