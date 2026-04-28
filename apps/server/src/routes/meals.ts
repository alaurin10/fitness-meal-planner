import { Router } from "express";
import { z } from "zod";
import { prisma, MEAL_SLOTS } from "@platform/db";
import {
  startOfWeek,
  addWeeks,
  computePlanWindow,
  parseLocalDate,
  ALL_DAYS,
  type WeekStartDay,
} from "@platform/shared";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import { getGeminiErrorMessage } from "../services/gemini.js";
import { generateMealPlan, generateSingleMeal } from "../services/mealPlan.js";
import { getTrainingSchedule } from "../services/schedule.js";
import { buildGroceryItems } from "../services/groceryAggregator.js";
import { mergeGroceryItems } from "../services/groceryMerge.js";
import type { GroceryItem } from "@platform/db";
import { normalizeMealPlan } from "../services/mealPlanNormalizer.js";
import {
  findActiveMealPlan,
  findMealPlanForWeek,
} from "../services/activePlan.js";
import {
  mealSchema,
  type MealJson,
  type MealPlanJson,
} from "../services/mealPlanSchema.js";

const mealCompletionSchema = z.object({
  planId: z.string().min(1),
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  indices: z.array(z.number().int().nonnegative()),
  totalMeals: z.number().int().nonnegative(),
});

const router = Router();

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

router.get("/current", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const weekStartParam = typeof req.query.weekStart === "string" ? req.query.weekStart : "";
  let plan;
  if (/^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
    plan = await findMealPlanForWeek(userId, parseLocalDate(weekStartParam));
  } else {
    plan = await findActiveMealPlan(userId);
  }
  if (!plan) {
    res.json({ plan: null });
    return;
  }
  res.json({
    plan: { ...plan, planJson: normalizeMealPlan(plan.planJson) },
  });
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
  if (daysToInclude.length === 0) {
    res.status(400).json({ error: "No remaining days this week." });
    return;
  }

  try {
    const schedule = await getTrainingSchedule(userId);
    const planJson = await generateMealPlan({ profile, schedule, daysToGenerate: daysToInclude });

    const result = await prisma.$transaction(async (tx) => {
      // Deactivate (not delete) existing plan for this week to preserve completions
      const existingPlan = await findMealPlanForWeek(userId, target);
      if (existingPlan) {
        await tx.weeklyMealPlan.update({
          where: { id: existingPlan.id },
          data: { isActive: false },
        });
      }

      // Deactivate older plans only when the new plan is for the current week
      if (isCurrentWeek) {
        await tx.weeklyMealPlan.updateMany({
          where: { userId, weekStartDate: { lt: target }, isActive: true },
          data: { isActive: false },
        });
      }

      const plan = await tx.weeklyMealPlan.create({
        data: {
          userId,
          weekStartDate: target,
          planJson,
          isActive: true,
        },
      });

      return { plan };
    });

    // Rebuild merged grocery list across all active plans
    const groceryList = await rebuildGroceries(userId);

    res.json({ plan: result.plan, groceryList });
  } catch (err) {
    const message = getGeminiErrorMessage(err);
    console.error("[meals] generate failed:", message);
    res.status(503).json({ error: "Failed to generate plan", detail: message });
  }
});

router.post("/empty", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const weekStartDay = (settings?.weekStartDay ?? "Mon") as WeekStartDay;
  const now = new Date();
  const thisWeek = startOfWeek(now, weekStartDay);

  const targetStr = typeof req.body.targetWeekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.targetWeekStart)
    ? req.body.targetWeekStart as string
    : null;
  const target = targetStr ? parseLocalDate(targetStr) : thisWeek;

  const planJson: MealPlanJson = {
    summary: "Manual plan — add meals from your recipe book or build new ones.",
    dailyCalorieTarget: 0,
    days: ALL_DAYS.map((day) => ({ day, meals: [] })),
  };

  const result = await prisma.$transaction(async (tx) => {
    const existingPlan = await findMealPlanForWeek(userId, target);
    if (existingPlan) {
      await tx.weeklyMealPlan.update({
        where: { id: existingPlan.id },
        data: { isActive: false },
      });
    }

    const plan = await tx.weeklyMealPlan.create({
      data: {
        userId,
        weekStartDate: target,
        planJson: planJson as unknown as object,
        isActive: true,
      },
    });
    return { plan };
  });

  const groceryList = await rebuildGroceries(userId);
  res.json({ plan: result.plan, groceryList });
});

const slotLocSchema = z.object({
  day: z.enum(DAYS),
  index: z.number().int().nonnegative(),
});

const slotMealSchema = slotLocSchema.extend({
  meal: mealSchema,
});

const slotAddSchema = z.object({
  day: z.enum(DAYS),
  meal: mealSchema,
});

const slotRegenSchema = z.object({
  day: z.enum(DAYS),
  index: z.number().int().nonnegative(),
});

// Replace a meal at (day, index) with the provided meal payload. Used for
// "swap from book" and inline edit.
router.put("/slot", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = slotMealSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const { plan } = await mutateActivePlan(userId, (planJson) => {
      const day = planJson.days.find((d) => d.day === parsed.data.day);
      if (!day) throw new Error("Day not found in plan");
      if (parsed.data.index >= day.meals.length) {
        day.meals.push(parsed.data.meal);
      } else {
        day.meals[parsed.data.index] = parsed.data.meal;
      }
      return planJson;
    });
    const groceryList = await rebuildGroceries(userId, plan.id);
    res.json({
      plan: { ...plan, planJson: normalizeMealPlan(plan.planJson) },
      groceryList,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Append a meal to a day (e.g., add a snack).
router.post("/slot/add", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = slotAddSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const { plan } = await mutateActivePlan(userId, (planJson) => {
      const day = planJson.days.find((d) => d.day === parsed.data.day);
      if (!day) throw new Error("Day not found in plan");
      day.meals.push(parsed.data.meal);
      return planJson;
    });
    const groceryList = await rebuildGroceries(userId, plan.id);
    res.json({
      plan: { ...plan, planJson: normalizeMealPlan(plan.planJson) },
      groceryList,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Remove a meal at (day, index).
router.delete("/slot", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = slotLocSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const { plan } = await mutateActivePlan(userId, (planJson) => {
      const day = planJson.days.find((d) => d.day === parsed.data.day);
      if (!day) throw new Error("Day not found in plan");
      day.meals.splice(parsed.data.index, 1);
      return planJson;
    });
    const groceryList = await rebuildGroceries(userId, plan.id);
    res.json({
      plan: { ...plan, planJson: normalizeMealPlan(plan.planJson) },
      groceryList,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Regenerate a single meal at (day, index) using Gemini.
router.post("/slot/regenerate", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = slotRegenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) {
    res.status(400).json({ error: "Create a profile first" });
    return;
  }
  const active = await findActiveMealPlan(userId);
  if (!active) {
    res.status(404).json({ error: "No active meal plan" });
    return;
  }
  const planJson = normalizeMealPlan(active.planJson);
  const dayEntry = planJson.days.find((d) => d.day === parsed.data.day);
  if (!dayEntry) {
    res.status(400).json({ error: "Day not found in plan" });
    return;
  }
  const existing = dayEntry.meals[parsed.data.index];
  const slot = pickSlot(existing, parsed.data.index);

  // Estimate per-meal targets from the day's other meals so the new meal
  // helps hit the day's totals without ballooning calories.
  const dayTargetCal = planJson.dailyCalorieTarget || profile.caloricTarget || 0;
  const dayTargetProtein = profile.proteinTargetG ?? 0;
  const otherMeals = dayEntry.meals.filter(
    (_, i) => i !== parsed.data.index,
  );
  const otherCal = otherMeals.reduce((s, m) => s + m.calories, 0);
  const otherProtein = otherMeals.reduce((s, m) => s + m.proteinG, 0);
  const expectedSlots = Math.max(3, dayEntry.meals.length || 3);
  const remainingCal = dayTargetCal
    ? Math.max(200, Math.round(dayTargetCal - otherCal))
    : Math.round((dayTargetCal || 600 * expectedSlots) / expectedSlots);
  const remainingProtein = dayTargetProtein
    ? Math.max(15, Math.round(dayTargetProtein - otherProtein))
    : 30;

  try {
    const newMeal: MealJson = await generateSingleMeal({
      profile,
      slot,
      targetCalories: remainingCal,
      targetProteinG: remainingProtein,
      avoidNames: existing ? [existing.name] : [],
    });

    const { plan } = await mutateActivePlan(userId, (json) => {
      const dEntry = json.days.find((d) => d.day === parsed.data.day);
      if (!dEntry) throw new Error("Day not found in plan");
      if (parsed.data.index >= dEntry.meals.length) {
        dEntry.meals.push(newMeal);
      } else {
        dEntry.meals[parsed.data.index] = newMeal;
      }
      return json;
    });
    const groceryList = await rebuildGroceries(userId, plan.id);
    res.json({
      plan: { ...plan, planJson: normalizeMealPlan(plan.planJson) },
      groceryList,
    });
  } catch (err) {
    const message = getGeminiErrorMessage(err);
    console.error("[meals] slot regenerate failed:", message);
    res
      .status(503)
      .json({ error: "Failed to regenerate meal", detail: message });
  }
});

function pickSlot(
  existing: MealJson | undefined,
  index: number,
): "breakfast" | "lunch" | "dinner" | "snack" {
  if (existing?.slot && MEAL_SLOTS.includes(existing.slot as never)) {
    return existing.slot as "breakfast" | "lunch" | "dinner" | "snack";
  }
  const order: Array<"breakfast" | "lunch" | "dinner" | "snack"> = [
    "breakfast",
    "lunch",
    "dinner",
    "snack",
  ];
  return order[index] ?? "snack";
}

async function mutateActivePlan(
  userId: string,
  mutator: (json: MealPlanJson) => MealPlanJson,
) {
  const active = await findActiveMealPlan(userId);
  if (!active) {
    throw new Error("No active meal plan");
  }
  const next = mutator(normalizeMealPlan(active.planJson));
  const updated = await prisma.weeklyMealPlan.update({
    where: { id: active.id },
    data: { planJson: next as unknown as object },
  });
  return { plan: updated };
}

/**
 * Rebuild the merged grocery list from all currently-relevant meal plans.
 * When called with a specific planId (after a slot mutation), we also use
 * that plan; otherwise we gather all plans with weekStartDate >= current week.
 */
async function rebuildGroceries(userId: string, planId?: string) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const weekStartDay = (settings?.weekStartDay ?? "Mon") as WeekStartDay;
  const thisWeek = startOfWeek(new Date(), weekStartDay);

  // Fetch all plans from current week onward, newest first per week
  const allPlans = await prisma.weeklyMealPlan.findMany({
    where: { userId, weekStartDate: { gte: thisWeek } },
    orderBy: [{ weekStartDate: "asc" }, { createdAt: "desc" }],
  });

  // Deduplicate: take only the latest plan per weekStartDate
  const plansByWeek = new Map<string, typeof allPlans[number]>();
  for (const p of allPlans) {
    const key = p.weekStartDate.toISOString();
    if (!plansByWeek.has(key)) {
      plansByWeek.set(key, p);
    }
  }

  // Build aggregated grocery items from all qualifying plans
  const allFresh: GroceryItem[] = [];
  for (const plan of plansByWeek.values()) {
    const planJson = normalizeMealPlan(plan.planJson);
    const items = buildGroceryItems(planJson);
    allFresh.push(...items);
  }

  // Merge with existing list to preserve manual items + check state
  const existing = await prisma.groceryList.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const merged = mergeGroceryItems(
    allFresh,
    Array.isArray(existing?.items) ? (existing!.items as never) : [],
  );

  // Link to the most recently relevant plan
  const linkPlanId = planId ?? plansByWeek.values().next().value?.id ?? null;

  if (existing) {
    return prisma.groceryList.update({
      where: { id: existing.id },
      data: {
        items: merged as unknown as object,
        ...(linkPlanId ? { weeklyMealPlanId: linkPlanId } : {}),
      },
    });
  }
  return prisma.groceryList.create({
    data: {
      userId,
      weeklyMealPlanId: linkPlanId,
      items: merged as unknown as object,
    },
  });
}

// ── Meal Completion Tracking ─────────────────────────────────────────

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
    plan = await prisma.weeklyMealPlan.findFirst({
      where: { id: planIdParam, userId },
    });
  } else {
    plan = await findActiveMealPlan(userId);
  }
  if (!plan) {
    res.json({ completion: null });
    return;
  }

  const completion = await prisma.mealCompletion.findUnique({
    where: { userId_planId_dayKey: { userId, planId: plan.id, dayKey } },
  });
  res.json({ completion });
});

router.put("/completions", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = mealCompletionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { planId, dayKey, indices, totalMeals } = parsed.data;

  // Verify plan belongs to user
  const plan = await prisma.weeklyMealPlan.findFirst({
    where: { id: planId, userId },
  });
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  const completedAt = totalMeals > 0 && indices.length >= totalMeals ? new Date() : null;

  const completion = await prisma.mealCompletion.upsert({
    where: { userId_planId_dayKey: { userId, planId, dayKey } },
    update: { indicesJson: indices, completedAt },
    create: { userId, planId, dayKey, indicesJson: indices, completedAt },
  });
  res.json({ completion });
});

export default router;
