import cors from "cors";
import express from "express";
import { clerkAuth } from "./middleware/auth.js";
import profileRouter from "./routes/profile.js";
import plansRouter from "./routes/plans.js";
import progressRouter from "./routes/progress.js";
import internalRouter from "./routes/internal.js";

const app = express();

const origin = process.env.FIT_CLIENT_ORIGIN ?? "http://localhost:5173";
app.use(
  cors({
    origin,
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "fit-server" });
});

app.use("/internal", internalRouter);

app.use(clerkAuth);
app.use("/api/profile", profileRouter);
app.use("/api/plans", plansRouter);
app.use("/api/progress", progressRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[fit-server] unhandled:", err);
  const message = err instanceof Error ? err.message : "internal_error";
  const status = message === "Unauthenticated" ? 401 : 500;
  res.status(status).json({ error: message });
});

const port = Number(process.env.FIT_SERVER_PORT ?? process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`[fit-server] listening on :${port}`);
});
