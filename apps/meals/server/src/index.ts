import cors from "cors";
import express from "express";
import { clerkAuth } from "./middleware/auth.js";
import profileRouter from "./routes/profile.js";
import plansRouter from "./routes/plans.js";
import groceriesRouter from "./routes/groceries.js";

const app = express();

const origin = process.env.MEALS_CLIENT_ORIGIN ?? "http://localhost:5174";
app.use(
  cors({
    origin,
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "meals-server" });
});

app.use(clerkAuth);
app.use("/api/profile", profileRouter);
app.use("/api/plans", plansRouter);
app.use("/api/groceries", groceriesRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[meals-server] unhandled:", err);
  const message = err instanceof Error ? err.message : "internal_error";
  const status = message === "Unauthenticated" ? 401 : 500;
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT ?? process.env.MEALS_SERVER_PORT ?? 3002);
app.listen(port, () => {
  console.log(`[meals-server] listening on :${port}`);
});
