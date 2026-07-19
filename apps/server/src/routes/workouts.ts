import { Router } from "express";
import { z } from "zod";
import { prisma } from "@platform/db";
import {
  startOfWeek,
  addWeeks,
  computePlanWindow,
  parseLocalDate,
  localDayKey,
  normalizeExerciseName,
  ALL_DAYS,
  type WeekStartDay,
  type DayLabel,
} from "@platform/shared";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { getGeminiErrorMessage } from "../services/gemini.js";
import { generateWeeklyPlan } from "../services/workoutPlan.js";
import {
  findActiveWorkoutPlan,
  findCurrentWeekWorkoutPlan,
  findWorkoutPlanForWeek,
} from "../services/activePlan.js";
import {
  weeklyPlanSchema,
  type WeeklyPlanJson,
} from "../services/workoutPlanSchema.js";
import { varietyParams } from "../services/varietyContext.js";
import {
  extractRecentExerciseNames,
  fetchRecentWorkoutPlanJsons,
} from "../services/workoutVarietyContext.js";

/**
 * Resolve the user's configured week-start day. Falls back to "Mon" if no
 * settings row exists yet.
 */
async function getUserWeekStartDay(userId: string): Promise<WeekStartDay> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  return (settings?.weekStartDay ?? "Mon") as WeekStartDay;
}

const router = Router();

// Throttle expensive Gemini-backed endpoints per user. Tunable via env.
const generationLimiter = rateLimit({
  windowMs: Number(process.env.GENERATION_RATE_WINDOW_MS) || 5 * 60 * 1000,
  max: Number(process.env.GENERATION_RATE_MAX) || 15,
  name: "workout generation",
});

const updateLoadSchema = z.object({
  day: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
  index: z.number().int().nonnegative(),
  loadLbs: z.number().positive(),
});

const bumpLoadSchema = z.object({
  day: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
  index: z.number().int().nonnegative(),
  deltaLbs: z.number().refine((n) => n !== 0, "deltaLbs must be non-zero").default(5),
});

const completionSchema = z.object({
  planId: z.string().min(1),
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  setsJson: z.record(z.array(z.number().int().positive())),
});

router.get("/current", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const weekStartParam = typeof req.query.weekStart === "string" ? req.query.weekStart : "";
  let plan;
  if (/^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
    plan = await findWorkoutPlanForWeek(userId, parseLocalDate(weekStartParam));
  } else {
    plan = await findCurrentWeekWorkoutPlan(userId, await getUserWeekStartDay(userId));
  }
  res.json({ plan });
});

router.get("/history", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const plans = await prisma.weeklyPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  res.json({ plans });
});

router.post("/generate", requireAuth, generationLimiter, async (req, res) => {
  const userId = currentUserId(req);
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) {
    res.status(400).json({ error: "Create a profile first" });
    return;
  }

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const weekStartDay = (settings?.weekStartDay ?? "Mon") as WeekStartDay;
  const now = new Date();
  const thisWeek = startOfWeek(now, weekStartDay);

  const targetStr = typeof req.body.targetWeekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.targetWeekStart)
    ? req.body.targetWeekStart as string
    : null;
  const target = targetStr ? parseLocalDate(targetStr) : thisWeek;

  if (target.getTime() < thisWeek.getTime()) {
    res.status(400).json({ error: "Cannot regenerate a past week." });
    return;
  }
  if (target.getTime() > addWeeks(thisWeek, 1).getTime()) {
    res.status(400).json({ error: "Future generation capped at +1 week." });
    return;
  }

  const { daysToInclude, isCurrentWeek } = computePlanWindow(target, now, weekStartDay);

  // Intersect with profile.trainingDays
  const trainingDays: DayLabel[] = (profile.trainingDays?.length
    ? profile.trainingDays
    : [...ALL_DAYS]) as DayLabel[];
  const workoutDays = daysToInclude.filter((d) => trainingDays.includes(d));
  if (workoutDays.length === 0) {
    res.status(400).json({ error: "No remaining training days this week." });
    return;
  }

  // Variety: feed recent weeks' exercise names in so new weeks rotate
  // accessories instead of rehashing the same lifts. Strength is a profile
  // preference (mirrors the meal-side variety machinery).
  const variety = varietyParams(profile.workoutVariety);

  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const [recentProgress, previousPlan, baselines, recentPlans] = await Promise.all([
    prisma.progressLog.findMany({
      where: { userId, loggedAt: { gte: fourWeeksAgo } },
      orderBy: { loggedAt: "desc" },
    }),
    findActiveWorkoutPlan(userId),
    prisma.userExerciseBaseline.findMany({ where: { userId } }),
    fetchRecentWorkoutPlanJsons(userId, target, variety.weeksBack),
  ]);
  const recentExerciseNames = extractRecentExerciseNames(recentPlans, variety.nameCap);

  try {
    const planJson = await generateWeeklyPlan({
      profile,
      recentProgress,
      previousPlan,
      baselines,
      daysToGenerate: workoutDays,
      recentExerciseNames,
      varietyTone: variety.promptTone,
      temperature: variety.temperature,
    });

    // Deactivate (not delete) existing plans for this week to preserve
    // completions, atomically with creating the replacement. See the
    // matching comment in meals /generate about the residual concurrent
    // race being acceptable.
    const created = await prisma.$transaction(async (tx) => {
      await tx.weeklyPlan.updateMany({
        where: { userId, weekStartDate: target, isActive: true },
        data: { isActive: false },
      });

      // Deactivate older plans only when the new plan is for the current week
      if (isCurrentWeek) {
        await tx.weeklyPlan.updateMany({
          where: { userId, weekStartDate: { lt: target }, isActive: true },
          data: { isActive: false },
        });
      }

      return tx.weeklyPlan.create({
        data: {
          userId,
          weekStartDate: target,
          planJson,
          isActive: true,
        },
      });
    });

    res.json({ plan: created });
  } catch (err) {
    const message = getGeminiErrorMessage(err);
    console.error("[workouts] generate failed:", message);
    res.status(503).json({ error: "Failed to generate plan", detail: message });
  }
});

/**
 * Manually set the prescribed load for an exercise in the active plan.
 * Also upserts the user's working baseline for that exercise so future
 * generated plans use this exact weight instead of the LLM's estimate.
 */
router.patch("/exercise", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = updateLoadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { day, index, loadLbs } = parsed.data;

  const plan = await findCurrentWeekWorkoutPlan(userId, await getUserWeekStartDay(userId));
  if (!plan) {
    res.status(404).json({ error: "No active workout plan" });
    return;
  }

  const validated = weeklyPlanSchema.safeParse(plan.planJson);
  if (!validated.success) {
    res.status(500).json({ error: "Stored plan is malformed" });
    return;
  }
  const planJson: WeeklyPlanJson = validated.data;

  const dayEntry = planJson.days.find((d) => d.day === day);
  const exercise = dayEntry?.exercises[index];
  if (!dayEntry || !exercise) {
    res.status(404).json({ error: "Exercise not found at that slot" });
    return;
  }

  const exerciseName = exercise.name;
  const normalizedKey = normalizeExerciseName(exerciseName);
  if (!normalizedKey) {
    res.status(400).json({ error: "Exercise name cannot be normalized" });
    return;
  }

  // Capture the prior working weight so we only log a change when it differs.
  const existingBaseline = await prisma.userExerciseBaseline.findUnique({
    where: { userId_normalizedKey: { userId, normalizedKey } },
  });
  const previousLoad = existingBaseline?.loadLbs ?? exercise.loadLbs ?? null;
  exercise.loadLbs = loadLbs;

  const result = await prisma.$transaction(async (tx) => {
    const updatedPlan = await tx.weeklyPlan.update({
      where: { id: plan.id },
      data: { planJson: planJson as unknown as object },
    });
    const baseline = await tx.userExerciseBaseline.upsert({
      where: { userId_normalizedKey: { userId, normalizedKey } },
      create: { userId, exerciseName, normalizedKey, loadLbs },
      update: { exerciseName, loadLbs },
    });
    // Record the weight change in the progress log so it surfaces in the
    // Progress tab's recent entries. Skip no-op saves (same weight).
    if (previousLoad == null || previousLoad !== loadLbs) {
      await tx.progressLog.create({
        data: { userId, weightLbs: null, liftPRs: { [exerciseName]: loadLbs } },
      });
    }
    return { plan: updatedPlan, baseline };
  });

  res.json(result);
});

/**
 * Bump the load for an exercise by a delta (default +5 lb). Used by the
 * "crushed it" UI affordance — same persistence as PATCH /exercise, but
 * relative to the current displayed weight (or the existing baseline if
 * the displayed weight is bodyweight/null).
 */
router.post("/exercise/bump", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = bumpLoadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { day, index, deltaLbs } = parsed.data;

  const plan = await findCurrentWeekWorkoutPlan(userId, await getUserWeekStartDay(userId));
  if (!plan) {
    res.status(404).json({ error: "No active workout plan" });
    return;
  }

  const validated = weeklyPlanSchema.safeParse(plan.planJson);
  if (!validated.success) {
    res.status(500).json({ error: "Stored plan is malformed" });
    return;
  }
  const planJson: WeeklyPlanJson = validated.data;

  const dayEntry = planJson.days.find((d) => d.day === day);
  const exercise = dayEntry?.exercises[index];
  if (!dayEntry || !exercise) {
    res.status(404).json({ error: "Exercise not found at that slot" });
    return;
  }

  const exerciseName = exercise.name;
  const normalizedKey = normalizeExerciseName(exerciseName);
  if (!normalizedKey) {
    res.status(400).json({ error: "Exercise name cannot be normalized" });
    return;
  }

  const existing = await prisma.userExerciseBaseline.findUnique({
    where: { userId_normalizedKey: { userId, normalizedKey } },
  });
  const current = existing?.loadLbs ?? exercise.loadLbs;
  if (current == null) {
    res.status(400).json({ error: "Cannot bump a bodyweight exercise — set a weight first" });
    return;
  }

  const newLoad = Math.max(0, current + deltaLbs);
  if (newLoad <= 0) {
    res.status(400).json({ error: "Resulting weight must be positive" });
    return;
  }
  exercise.loadLbs = newLoad;

  const result = await prisma.$transaction(async (tx) => {
    const updatedPlan = await tx.weeklyPlan.update({
      where: { id: plan.id },
      data: { planJson: planJson as unknown as object },
    });
    const baseline = await tx.userExerciseBaseline.upsert({
      where: { userId_normalizedKey: { userId, normalizedKey } },
      create: { userId, exerciseName, normalizedKey, loadLbs: newLoad },
      update: { exerciseName, loadLbs: newLoad },
    });
    // A bump always changes the weight, so always log it for recent entries.
    await tx.progressLog.create({
      data: { userId, weightLbs: null, liftPRs: { [exerciseName]: newLoad } },
    });
    return { plan: updatedPlan, baseline };
  });

  res.json(result);
});

// ── Workout Completion Tracking ──────────────────────────────────────

router.get("/completions", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const dayKey = typeof req.query.dayKey === "string" ? req.query.dayKey : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    res.status(400).json({ error: "dayKey must be YYYY-MM-DD" });
    return;
  }

  // Accept optional planId to support week navigation (viewing past/future weeks)
  const planIdParam = typeof req.query.planId === "string" ? req.query.planId : "";
  let plan;
  if (planIdParam) {
    plan = await prisma.weeklyPlan.findFirst({
      where: { id: planIdParam, userId },
    });
  } else {
    plan = await findCurrentWeekWorkoutPlan(userId, await getUserWeekStartDay(userId));
  }
  if (!plan) {
    res.json({ completion: null });
    return;
  }

  const completion = await prisma.workoutCompletion.findUnique({
    where: { userId_planId_dayKey: { userId, planId: plan.id, dayKey } },
  });
  res.json({ completion });
});

router.put("/completions", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = completionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { planId, dayKey } = parsed.data;
  let setsJson = parsed.data.setsJson as Record<string, number[]>;

  // Verify plan belongs to user
  const plan = await prisma.weeklyPlan.findFirst({
    where: { id: planId, userId },
  });
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  // Determine if all sets for every exercise are complete by checking plan data
  const validated = weeklyPlanSchema.safeParse(plan.planJson);
  let completedAt: Date | null = null;
  if (validated.success) {
    // Derive which day-of-week from the dayKey
    const date = new Date(dayKey + "T12:00:00");
    const dayLabel = ALL_DAYS[(date.getDay() + 6) % 7]!;
    const dayEntry = validated.data.days.find((d) => d.day === dayLabel);
    if (dayEntry) {
      // Drop keys that don't map to an exercise on that day so stored
      // completions never reference slots outside the plan.
      setsJson = Object.fromEntries(
        Object.entries(setsJson).filter(([key]) => {
          const idx = Number(key);
          return Number.isInteger(idx) && idx >= 0 && idx < dayEntry.exercises.length;
        }),
      );
      const allDone = dayEntry.exercises.every((ex, idx) => {
        const completedSets = setsJson[String(idx)] ?? [];
        return completedSets.length >= ex.sets;
      });
      if (allDone) {
        // Preserve the original completion timestamp on re-PUTs.
        const existing = await prisma.workoutCompletion.findUnique({
          where: { userId_planId_dayKey: { userId, planId, dayKey } },
        });
        completedAt = existing?.completedAt ?? new Date();
      }
    }
  }

  const completion = await prisma.workoutCompletion.upsert({
    where: { userId_planId_dayKey: { userId, planId, dayKey } },
    update: { setsJson, completedAt },
    create: { userId, planId, dayKey, setsJson, completedAt },
  });
  res.json({ completion });
});

export default router;
