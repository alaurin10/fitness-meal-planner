import cors from "cors";
import express from "express";
import { clerkAuth } from "./middleware/auth.js";
import profileRouter from "./routes/profile.js";
import workoutsRouter from "./routes/workouts.js";
import mealsRouter from "./routes/meals.js";
import groceriesRouter from "./routes/groceries.js";
import progressRouter from "./routes/progress.js";
import recipesRouter from "./routes/recipes.js";
import settingsRouter from "./routes/settings.js";
import hydrationRouter from "./routes/hydration.js";

const app = express();

const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
app.use(
  cors({
    origin,
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "app-server" });
});

app.use(clerkAuth);
app.use("/api/profile", profileRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/workouts", workoutsRouter);
app.use("/api/meals", mealsRouter);
app.use("/api/groceries", groceriesRouter);
app.use("/api/progress", progressRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/hydration", hydrationRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[app-server] unhandled:", err);
  const message = err instanceof Error ? err.message : "internal_error";
  const status = message === "Unauthenticated" ? 401 : 500;
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`[app-server] listening on :${port}`);
});
