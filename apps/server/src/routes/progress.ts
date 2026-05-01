import { Router } from "express";
import { z } from "zod";
import { prisma } from "@platform/db";
import { ALL_DAYS } from "@platform/shared";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import { computeTargets } from "../services/targets.js";
import { computeStreaks } from "../services/streakCalculator.js";
import {
  findActiveWorkoutPlan,
  findActiveMealPlan,
} from "../services/activePlan.js";
import { computeWorkoutVolumeLbs } from "../services/workoutVolume.js";

const router = Router();

const progressSchema = z.object({
  weightLbs: z.number().positive().nullable().optional(),
  note: z.string().max(500).optional(),
  liftPRs: z.record(z.number().positive()).optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const logs = await prisma.progressLog.findMany({
    where: { userId },
    orderBy: { loggedAt: "desc" },
    take: 60,
  });
  res.json({ logs });
});

router.post("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });

  const log = await prisma.progressLog.create({
    data: {
      userId,
      weightLbs: parsed.data.weightLbs ?? null,
      note: parsed.data.note ?? null,
      liftPRs: parsed.data.liftPRs ?? undefined,
    },
  });

  // Sync weight back to the profile so calorie/protein targets stay accurate.
  // If the user's stored targets currently match the suggested values for their
  // OLD weight, they're on "suggested" mode — recompute targets at the new
  // weight. Otherwise they've explicitly overridden the targets, so preserve.
  let profile = null;
  if (parsed.data.weightLbs != null) {
    const current = await prisma.profile.findUnique({ where: { userId } });
    if (current) {
      const oldSuggested = computeTargets({
        sex: current.sex,
        age: current.age,
        weightLbs: current.weightLbs,
        heightIn: current.heightIn,
        trainingDaysPerWeek: current.trainingDaysPerWeek,
        goal: current.goal,
      });
      const newSuggested = computeTargets({
        sex: current.sex,
        age: current.age,
        weightLbs: parsed.data.weightLbs,
        heightIn: current.heightIn,
        trainingDaysPerWeek: current.trainingDaysPerWeek,
        goal: current.goal,
      });

      const onSuggestedCalories =
        oldSuggested != null && current.caloricTarget === oldSuggested.caloricTarget;
      const onSuggestedProtein =
        oldSuggested != null && current.proteinTargetG === oldSuggested.proteinTargetG;

      profile = await prisma.profile.update({
        where: { userId },
        data: {
          weightLbs: parsed.data.weightLbs,
          caloricTarget:
            onSuggestedCalories && newSuggested
              ? newSuggested.caloricTarget
              : current.caloricTarget,
          proteinTargetG:
            onSuggestedProtein && newSuggested
              ? newSuggested.proteinTargetG
              : current.proteinTargetG,
        },
      });
    }
  }

  res.json({ log, profile });
});

// ── Daily Summary ────────────────────────────────────────────────────

router.get("/daily-summary", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const dayKey = typeof req.query.dayKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.dayKey)
    ? req.query.dayKey
    : localDayKey();

  const [profile, workoutPlan, mealPlan, hydrationLog] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    findActiveWorkoutPlan(userId),
    findActiveMealPlan(userId),
    prisma.hydrationLog.findUnique({
      where: { userId_date: { userId, date: new Date(dayKey + "T00:00:00.000Z") } },
    }),
  ]);

  // Workout progress
  let workoutSets = { completed: 0, total: 0 };
  let workoutDone = false;
  let workoutVolumeLbs = 0;
  if (workoutPlan) {
    const wc = await prisma.workoutCompletion.findUnique({
      where: { userId_planId_dayKey: { userId, planId: workoutPlan.id, dayKey } },
    });
    const date = new Date(dayKey + "T12:00:00");
    const dayLabel = ALL_DAYS[(date.getDay() + 6) % 7]!;
    const planJson = workoutPlan.planJson as { days?: { day: string; exercises?: { sets: number; reps?: string | null; loadLbs?: number | null }[] }[] };
    const dayEntry = planJson.days?.find((d) => d.day === dayLabel);
    const totalSets = dayEntry?.exercises?.reduce((s, e) => s + e.sets, 0) ?? 0;
    let completedSets = 0;
    let setsJson: Record<string, number[]> = {};
    if (wc?.setsJson) {
      setsJson = wc.setsJson as Record<string, number[]>;
      completedSets = Object.values(setsJson).reduce((s, arr) => s + arr.length, 0);
    }
    workoutSets = { completed: completedSets, total: totalSets };
    workoutDone = wc?.completedAt != null;
    if (dayEntry?.exercises && completedSets > 0) {
      workoutVolumeLbs = computeWorkoutVolumeLbs({
        exercises: dayEntry.exercises,
        completedSets: setsJson,
        profileWeightLbs: profile?.weightLbs ?? null,
      });
    }
  }

  // Meal progress
  let mealProgress = { completed: 0, total: 0, calories: 0, protein: 0 };
  let mealsDone = false;
  if (mealPlan) {
    const mc = await prisma.mealCompletion.findUnique({
      where: { userId_planId_dayKey: { userId, planId: mealPlan.id, dayKey } },
    });
    const date = new Date(dayKey + "T12:00:00");
    const dayLabel = ALL_DAYS[(date.getDay() + 6) % 7]!;
    const planJson = mealPlan.planJson as { days?: { day: string; meals?: { calories: number; proteinG: number }[] }[] };
    const dayEntry = planJson.days?.find((d) => d.day === dayLabel);
    const totalMeals = dayEntry?.meals?.length ?? 0;
    const completedIndices: number[] = mc?.indicesJson ? (mc.indicesJson as number[]) : [];
    const completedCalories = completedIndices.reduce((s, idx) => s + (dayEntry?.meals?.[idx]?.calories ?? 0), 0);
    const completedProtein = completedIndices.reduce((s, idx) => s + (dayEntry?.meals?.[idx]?.proteinG ?? 0), 0);
    mealProgress = { completed: completedIndices.length, total: totalMeals, calories: completedCalories, protein: completedProtein };
    mealsDone = mc?.completedAt != null;
  }

  res.json({
    workout: {
      ...workoutSets,
      done: workoutDone,
      isRestDay: workoutSets.total === 0,
      volumeLbs: workoutVolumeLbs,
    },
    meals: { ...mealProgress, done: mealsDone },
    hydration: {
      cups: hydrationLog?.cups ?? 0,
      goal: profile?.hydrationGoal ?? 8,
    },
    targets: {
      caloricTarget: profile?.caloricTarget ?? null,
      proteinTargetG: profile?.proteinTargetG ?? null,
    },
  });
});

// ── History ──────────────────────────────────────────────────────────

const historySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.get("/history", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = historySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "from and to must be YYYY-MM-DD" });
    return;
  }
  const { from, to } = parsed.data;
  const fromDate = new Date(from + "T00:00:00Z");
  const toDate = new Date(to + "T23:59:59Z");

  const [workoutCompletions, mealCompletions, hydrationLogs, profile, allWorkoutPlans, allMealPlans] = await Promise.all([
    prisma.workoutCompletion.findMany({
      where: { userId, dayKey: { gte: from, lte: to } },
    }),
    prisma.mealCompletion.findMany({
      where: { userId, dayKey: { gte: from, lte: to } },
    }),
    prisma.hydrationLog.findMany({
      where: { userId, date: { gte: fromDate, lte: toDate } },
    }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.weeklyPlan.findMany({
      where: { userId },
      orderBy: [{ weekStartDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.weeklyMealPlan.findMany({
      where: { userId },
      orderBy: [{ weekStartDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const hydrationGoal = profile?.hydrationGoal ?? 8;

  // Build day-by-day records
  const days: Record<string, {
    workout: { completed: number; total: number; done: boolean; volumeLbs: number };
    meals: { completed: number; total: number; calories: number; protein: number; done: boolean };
    hydration: { cups: number; goal: number; done: boolean };
  }> = {};

  // Initialize all days in range
  const cursor = new Date(from + "T12:00:00");
  const end = new Date(to + "T12:00:00");
  while (cursor <= end) {
    const dk = localDayKeyFromDate(cursor);
    days[dk] = {
      workout: { completed: 0, total: 0, done: false, volumeLbs: 0 },
      meals: { completed: 0, total: 0, calories: 0, protein: 0, done: false },
      hydration: { cups: 0, goal: hydrationGoal, done: false },
    };
    cursor.setDate(cursor.getDate() + 1);
  }

  // Fill workout data
  for (const wc of workoutCompletions) {
    const day = days[wc.dayKey];
    if (!day) continue;
    const sets = wc.setsJson as Record<string, number[]>;
    day.workout.completed = Object.values(sets).reduce((s, arr) => s + arr.length, 0);
    day.workout.done = wc.completedAt != null;
  }

  const workoutCompletionsByDay = new Map(
    workoutCompletions.map((c) => [c.dayKey, c]),
  );
  for (const dk of Object.keys(days)) {
    const rec = days[dk];
    if (!rec) continue;
    const dkDate = new Date(dk + "T12:00:00");
    const workoutPlan = allWorkoutPlans.find((p) => p.weekStartDate <= dkDate);
    if (!workoutPlan) continue;
    const planJson = workoutPlan.planJson as { days?: { day: string; exercises?: { sets: number; reps?: string | null; loadLbs?: number | null }[] }[] };
    const dayLabel = ALL_DAYS[(dkDate.getDay() + 6) % 7]!;
    const dayEntry = planJson.days?.find((d) => d.day === dayLabel);
    const exercises = dayEntry?.exercises;
    rec.workout.total = exercises?.reduce((s, e) => s + e.sets, 0) ?? 0;
    if (exercises && rec.workout.completed > 0) {
      const wc = workoutCompletionsByDay.get(dk);
      const setsJson = (wc?.setsJson as Record<string, number[]> | undefined) ?? {};
      rec.workout.volumeLbs = computeWorkoutVolumeLbs({
        exercises,
        completedSets: setsJson,
        profileWeightLbs: profile?.weightLbs ?? null,
      });
    }
  }

  // Fill meal data
  for (const mc of mealCompletions) {
    const day = days[mc.dayKey];
    if (!day) continue;
    const indices = mc.indicesJson as number[];
    day.meals.completed = indices.length;
    day.meals.done = mc.completedAt != null;
  }

  // Fill meal totals from per-dayKey plan resolution
  for (const dk of Object.keys(days)) {
    const rec = days[dk];
    if (!rec) continue;
    const dkDate = new Date(dk + "T12:00:00");
    const mealPlan = allMealPlans.find((p) => p.weekStartDate <= dkDate);
    if (!mealPlan) continue;
    const planJson = mealPlan.planJson as { days?: { day: string; meals?: { calories: number; proteinG: number }[] }[] };
    const dayLabel = ALL_DAYS[(dkDate.getDay() + 6) % 7]!;
    const dayEntry = planJson.days?.find((d) => d.day === dayLabel);
    rec.meals.total = dayEntry?.meals?.length ?? 0;

    // Fill calorie/protein from completed meal indices
    const mc = mealCompletions.find((c) => c.dayKey === dk);
    if (mc && dayEntry?.meals) {
      const indices = mc.indicesJson as number[];
      rec.meals.calories = indices.reduce((s, idx) => s + (dayEntry.meals?.[idx]?.calories ?? 0), 0);
      rec.meals.protein = indices.reduce((s, idx) => s + (dayEntry.meals?.[idx]?.proteinG ?? 0), 0);
    }
  }

  // Fill hydration. Hydration logs store midnight UTC of the user's local
  // dayKey, so convert back via UTC components — not local — to recover it.
  for (const hl of hydrationLogs) {
    const dk = dayKeyFromHydrationDate(hl.date);
    const day = days[dk];
    if (!day) continue;
    day.hydration.cups = hl.cups;
    day.hydration.done = hl.cups >= hydrationGoal;
  }

  res.json({ days, targets: { caloricTarget: profile?.caloricTarget ?? null, proteinTargetG: profile?.proteinTargetG ?? null } });
});

// ── Streaks ──────────────────────────────────────────────────────────

router.get("/streaks", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const ninetyDaysAgo = localDayKeyFromDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));

  const [profile, workoutCompletions, mealCompletions, hydrationLogs, workoutPlan] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.workoutCompletion.findMany({
      where: { userId, dayKey: { gte: ninetyDaysAgo } },
      orderBy: { dayKey: "desc" },
    }),
    prisma.mealCompletion.findMany({
      where: { userId, dayKey: { gte: ninetyDaysAgo } },
      orderBy: { dayKey: "desc" },
    }),
    prisma.hydrationLog.findMany({
      where: { userId, date: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
      orderBy: { date: "desc" },
    }),
    findActiveWorkoutPlan(userId),
  ]);

  const hydrationGoal = profile?.hydrationGoal ?? 8;

  // Build sets of completed dates
  const workoutDates = new Set(workoutCompletions.filter((wc) => wc.completedAt != null).map((wc) => wc.dayKey));
  const mealDates = new Set(mealCompletions.filter((mc) => mc.completedAt != null).map((mc) => mc.dayKey));
  const hydrationDates = new Set(hydrationLogs.filter((hl) => hl.cups >= hydrationGoal).map((hl) => dayKeyFromHydrationDate(hl.date)));

  // Rest days (days with no scheduled workout)
  const restDays = new Set<string>();
  if (workoutPlan) {
    const planJson = workoutPlan.planJson as { days?: { day: string; exercises?: unknown[] }[] };
    const restDayNames = new Set(
      planJson.days?.filter((d) => !d.exercises || d.exercises.length === 0).map((d) => d.day) ?? []
    );
    // Map rest day names to dates in the range
    const cursor = new Date();
    for (let i = 0; i < 90; i++) {
      const dk = localDayKeyFromDate(cursor);
      const dayLabel = ALL_DAYS[(cursor.getDay() + 6) % 7]!;
      if (restDayNames.has(dayLabel)) restDays.add(dk);
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  const streaks = computeStreaks({
    workoutDates,
    mealDates,
    hydrationDates,
    restDays,
  });

  res.json(streaks);
});

function localDayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localDayKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// HydrationLog.date is stored as midnight UTC of the user's local dayKey, so
// recover the original dayKey using UTC components.
function dayKeyFromHydrationDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default router;
