import { Router } from "express";
import { z } from "zod";
import { prisma, MEAL_SLOTS, Prisma } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import { getGeminiErrorMessage } from "../services/gemini.js";
import { generateMealPlan, generateSingleMeal } from "../services/mealPlan.js";
import { getTrainingSchedule } from "../services/schedule.js";
import { buildGroceryItems } from "../services/groceryAggregator.js";
import { mergeGroceryItems } from "../services/groceryMerge.js";
import type { GroceryItem } from "@platform/db";
import { normalizeMealPlan } from "../services/mealPlanNormalizer.js";
import {
  mealSchema,
  type MealJson,
  type MealPlanJson,
} from "../services/mealPlanSchema.js";
import {
  parseWeekParam,
  weekStartFor,
  startOfWeek,
  type WeekKey,
} from "../services/weekStart.js";

const router = Router();

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const weekBodySchema = z
  .object({ week: z.enum(["current", "next"]).optional() })
  .optional();

router.get("/current", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const week = parseWeekParam(req.query.week);
  const plan = await findPlanForWeek(userId, week);
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
  const week = parseWeekParam(req.body?.week);
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) {
    res.status(400).json({ error: "Create a profile first" });
    return;
  }

  try {
    const schedule = await getTrainingSchedule(userId);
    const planJson = await generateMealPlan({ profile, schedule });
    const weekStart = weekStartFor(week);
    const fresh = buildGroceryItems(planJson);

    const result = await prisma.$transaction(async (tx) => {
      // Carry over manual / hand-edited items from the SAME week's prior
      // grocery list so regenerating this week's plan doesn't wipe what
      // the user already gathered.
      const previousItems = await readPreviousItemsForWeek(tx, userId, weekStart);
      const merged = mergeGroceryItems(fresh, previousItems);

      await deletePlansForWeek(tx, userId, weekStart);
      await deletePastPlans(tx, userId);

      const plan = await tx.weeklyMealPlan.create({
        data: {
          userId,
          weekStartDate: weekStart,
          planJson,
          isActive: true,
        },
      });
      const groceryList = await tx.groceryList.create({
        data: {
          userId,
          weeklyMealPlanId: plan.id,
          items: merged as unknown as object,
        },
      });
      return { plan, groceryList };
    });

    res.json(result);
  } catch (err) {
    const message = getGeminiErrorMessage(err);
    console.error("[meals] generate failed:", message);
    res.status(503).json({ error: "Failed to generate plan", detail: message });
  }
});

// Create a blank weekly plan with 7 days × 0 meals so the user can build
// the week manually.
router.post("/empty", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsedBody = weekBodySchema.safeParse(req.body);
  const week: WeekKey = parsedBody.success
    ? parseWeekParam(parsedBody.data?.week)
    : "current";
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });
  const planJson: MealPlanJson = {
    summary: "Manual plan — add meals from your recipe book or build new ones.",
    dailyCalorieTarget: 0,
    days: DAYS.map((day) => ({ day, meals: [] })),
  };
  const weekStart = weekStartFor(week);

  const result = await prisma.$transaction(async (tx) => {
    await deletePlansForWeek(tx, userId, weekStart);
    await deletePastPlans(tx, userId);

    const plan = await tx.weeklyMealPlan.create({
      data: {
        userId,
        weekStartDate: weekStart,
        planJson: planJson as unknown as object,
        isActive: true,
      },
    });
    const groceryList = await tx.groceryList.create({
      data: {
        userId,
        weeklyMealPlanId: plan.id,
        items: [] as unknown as object,
      },
    });
    return { plan, groceryList };
  });

  res.json(result);
});

const slotLocSchema = z.object({
  day: z.enum(DAYS),
  index: z.number().int().nonnegative(),
  week: z.enum(["current", "next"]).optional(),
});

const slotMealSchema = slotLocSchema.extend({
  meal: mealSchema,
});

const slotAddSchema = z.object({
  day: z.enum(DAYS),
  meal: mealSchema,
  week: z.enum(["current", "next"]).optional(),
});

const slotRegenSchema = z.object({
  day: z.enum(DAYS),
  index: z.number().int().nonnegative(),
  week: z.enum(["current", "next"]).optional(),
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
    const week = parseWeekParam(parsed.data.week);
    const { plan } = await mutatePlanForWeek(userId, week, (planJson) => {
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
    const week = parseWeekParam(parsed.data.week);
    const { plan } = await mutatePlanForWeek(userId, week, (planJson) => {
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
    const week = parseWeekParam(parsed.data.week);
    const { plan } = await mutatePlanForWeek(userId, week, (planJson) => {
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
  const week = parseWeekParam(parsed.data.week);
  const active = await findPlanForWeek(userId, week);
  if (!active) {
    res.status(404).json({ error: "No meal plan for that week" });
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

    const { plan } = await mutatePlanForWeek(userId, week, (json) => {
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

export async function findPlanForWeek(userId: string, week: WeekKey) {
  const weekStart = weekStartFor(week);
  return prisma.weeklyMealPlan.findFirst({
    where: { userId, weekStartDate: weekStart, isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

async function mutatePlanForWeek(
  userId: string,
  week: WeekKey,
  mutator: (json: MealPlanJson) => MealPlanJson,
) {
  const active = await findPlanForWeek(userId, week);
  if (!active) {
    throw new Error("No meal plan for that week");
  }
  const next = mutator(normalizeMealPlan(active.planJson));
  const updated = await prisma.weeklyMealPlan.update({
    where: { id: active.id },
    data: { planJson: next as unknown as object },
  });
  return { plan: updated };
}

async function rebuildGroceries(userId: string, planId: string) {
  const plan = await prisma.weeklyMealPlan.findFirst({
    where: { id: planId, userId },
  });
  if (!plan) throw new Error("Plan vanished mid-update");
  const planJson = normalizeMealPlan(plan.planJson);
  const fresh = buildGroceryItems(planJson);
  const existing = await prisma.groceryList.findFirst({
    where: { userId, weeklyMealPlanId: planId },
    orderBy: { createdAt: "desc" },
  });
  const merged = mergeGroceryItems(
    fresh,
    Array.isArray(existing?.items) ? (existing!.items as never) : [],
  );
  if (existing) {
    return prisma.groceryList.update({
      where: { id: existing.id },
      data: { items: merged as unknown as object },
    });
  }
  return prisma.groceryList.create({
    data: {
      userId,
      weeklyMealPlanId: planId,
      items: merged as unknown as object,
    },
  });
}

async function readPreviousItemsForWeek(
  tx: Prisma.TransactionClient,
  userId: string,
  weekStart: Date,
): Promise<GroceryItem[]> {
  const previousPlan = await tx.weeklyMealPlan.findFirst({
    where: { userId, weekStartDate: weekStart },
    orderBy: { createdAt: "desc" },
  });
  if (!previousPlan) return [];
  const previousList = await tx.groceryList.findFirst({
    where: { userId, weeklyMealPlanId: previousPlan.id },
    orderBy: { createdAt: "desc" },
  });
  return Array.isArray(previousList?.items)
    ? (previousList!.items as unknown as GroceryItem[])
    : [];
}

async function deletePlansForWeek(
  tx: Prisma.TransactionClient,
  userId: string,
  weekStart: Date,
): Promise<void> {
  const plans = await tx.weeklyMealPlan.findMany({
    where: { userId, weekStartDate: weekStart },
    select: { id: true },
  });
  if (plans.length === 0) return;
  const ids = plans.map((p) => p.id);
  await tx.groceryList.deleteMany({
    where: { weeklyMealPlanId: { in: ids } },
  });
  await tx.weeklyMealPlan.deleteMany({ where: { id: { in: ids } } });
}

async function deletePastPlans(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const cutoff = startOfWeek(new Date());
  const plans = await tx.weeklyMealPlan.findMany({
    where: { userId, weekStartDate: { lt: cutoff } },
    select: { id: true },
  });
  if (plans.length === 0) return;
  const ids = plans.map((p) => p.id);
  await tx.groceryList.deleteMany({
    where: { weeklyMealPlanId: { in: ids } },
  });
  await tx.weeklyMealPlan.deleteMany({ where: { id: { in: ids } } });
}

export default router;
