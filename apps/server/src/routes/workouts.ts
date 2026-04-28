import { Router } from "express";
import { z } from "zod";
import { prisma } from "@platform/db";
import {
  startOfWeek,
  addWeeks,
  computePlanWindow,
  parseLocalDate,
  localDayKey,
  ALL_DAYS,
  type WeekStartDay,
  type DayLabel,
} from "@platform/shared";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import { getGeminiErrorMessage } from "../services/gemini.js";
import { generateWeeklyPlan } from "../services/workoutPlan.js";
import {
  findActiveWorkoutPlan,
  findWorkoutPlanForWeek,
} from "../services/activePlan.js";
import {
  weeklyPlanSchema,
  type WeeklyPlanJson,
} from "../services/workoutPlanSchema.js";

const router = Router();

const updateLoadSchema = z.object({
  day: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
  index: z.number().int().nonnegative(),
  loadLbs: z.number().positive(),
  note: z.string().max(280).optional(),
});

const completionSchema = z.object({
  planId: z.string().min(1),
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  setsJson: z.record(z.array(z.number().int().positive())),
  totalExercises: z.number().int().nonnegative(),
});

router.get("/current", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const weekStartParam = typeof req.query.weekStart === "string" ? req.query.weekStart : "";
  let plan;
  if (/^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
    plan = await findWorkoutPlanForWeek(userId, parseLocalDate(weekStartParam));
  } else {
    plan = await findActiveWorkoutPlan(userId);
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

router.post("/generate", requireAuth, async (req, res) => {
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

  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const [recentProgress, previousPlan] = await Promise.all([
    prisma.progressLog.findMany({
      where: { userId, loggedAt: { gte: fourWeeksAgo } },
      orderBy: { loggedAt: "desc" },
    }),
    findActiveWorkoutPlan(userId),
  ]);

  try {
    const planJson = await generateWeeklyPlan({
      profile,
      recentProgress,
      previousPlan,
      daysToGenerate: workoutDays,
    });

    // Deactivate (not delete) any existing plan for this week to preserve completions
    const existing = await findWorkoutPlanForWeek(userId, target);
    if (existing) {
      await prisma.weeklyPlan.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
    }

    // Deactivate older plans only when the new plan is for the current week
    if (isCurrentWeek) {
      await prisma.weeklyPlan.updateMany({
        where: { userId, weekStartDate: { lt: target }, isActive: true },
        data: { isActive: false },
      });
    }

    const created = await prisma.weeklyPlan.create({
      data: {
        userId,
        weekStartDate: target,
        planJson,
        isActive: true,
      },
    });

    res.json({ plan: created });
  } catch (err) {
    const message = getGeminiErrorMessage(err);
    console.error("[workouts] generate failed:", message);
    res.status(503).json({ error: "Failed to generate plan", detail: message });
  }
});

/**
 * Manually update the prescribed load for an exercise in the active plan,
 * and record it as a new PR in the progress log so future generated plans
 * anchor to this weight instead of the AI's original estimate.
 */
router.patch("/exercise", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = updateLoadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { day, index, loadLbs, note } = parsed.data;

  const plan = await findActiveWorkoutPlan(userId);
  if (!plan) {
    res.status(404).json({ error: "No active workout plan" });
    return;
  }

  // Validate the stored planJson before mutating it. If it doesn't parse,
  // bail out rather than corrupt the record further.
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
  exercise.loadLbs = loadLbs;

  // Persist the plan + a fresh progress log in one transaction so the two
  // can never drift apart.
  const result = await prisma.$transaction(async (tx) => {
    const updatedPlan = await tx.weeklyPlan.update({
      where: { id: plan.id },
      data: { planJson: planJson as unknown as object },
    });
    const log = await tx.progressLog.create({
      data: {
        userId,
        weightLbs: null,
        note: note ?? `New baseline for ${exerciseName}`,
        liftPRs: { [exerciseName]: loadLbs },
      },
    });
    return { plan: updatedPlan, log };
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
    plan = await findActiveWorkoutPlan(userId);
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
  const { planId, dayKey, setsJson, totalExercises } = parsed.data;

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
      const allDone = dayEntry.exercises.every((ex, idx) => {
        const completedSets = (setsJson as Record<string, number[]>)[String(idx)] ?? [];
        return completedSets.length >= ex.sets;
      });
      if (allDone) completedAt = new Date();
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
