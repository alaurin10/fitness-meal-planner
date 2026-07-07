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
  type DayLabel,
} from "@platform/shared";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { getGeminiErrorMessage } from "../services/gemini.js";
import { generateMealPlan, generateSingleMeal } from "../services/mealPlan.js";
import {
  collectWeekAvoidNames,
  extractRecentMealNames,
  fetchRecentPlanJsons,
  varietyParams,
} from "../services/varietyContext.js";
import { getTrainingSchedule } from "../services/schedule.js";
import { buildGroceryItems } from "../services/groceryAggregator.js";
import { mergeGroceryItems } from "../services/groceryMerge.js";
import type { GroceryItem } from "@platform/db";
import { normalizeMealPlan } from "../services/mealPlanNormalizer.js";
import {
  applyLeftoverUpdate,
  findDependentLeftovers,
} from "../services/leftoverLinks.js";
import {
  dayLabelForDayKey,
  validateMealCompletion,
} from "../services/completionValidation.js";
import {
  reconcileIndices,
  type ReconcileOp,
} from "../services/completionReconciler.js";
import {
  findCurrentWeekMealPlan,
  findMealPlanForWeek,
} from "../services/activePlan.js";
import {
  mealSchema,
  type MealJson,
  type MealPlanJson,
} from "../services/mealPlanSchema.js";

/**
 * Resolve the user's configured week-start day. Falls back to "Mon" if no
 * settings row exists yet.
 */
async function getUserWeekStartDay(userId: string): Promise<WeekStartDay> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  return (settings?.weekStartDay ?? "Mon") as WeekStartDay;
}

const mealCompletionSchema = z.object({
  planId: z.string().min(1),
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  indices: z.array(z.number().int().nonnegative()),
});

const router = Router();

// Throttle expensive Gemini-backed endpoints per user. Tunable via env.
const generationLimiter = rateLimit({
  windowMs: Number(process.env.GENERATION_RATE_WINDOW_MS) || 5 * 60 * 1000,
  max: Number(process.env.GENERATION_RATE_MAX) || 15,
  name: "meal generation",
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

router.get("/current", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const weekStartParam = typeof req.query.weekStart === "string" ? req.query.weekStart : "";
  let plan;
  if (/^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
    plan = await findMealPlanForWeek(userId, parseLocalDate(weekStartParam));
  } else {
    const weekStartDay = await getUserWeekStartDay(userId);
    plan = await findCurrentWeekMealPlan(userId, weekStartDay);
  }
  if (!plan) {
    res.json({ plan: null });
    return;
  }
  res.json({
    plan: { ...plan, planJson: normalizeMealPlan(plan.planJson) },
  });
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
  if (daysToInclude.length === 0) {
    res.status(400).json({ error: "No remaining days this week." });
    return;
  }

  try {
    const schedule = await getTrainingSchedule(userId);
    // Variety: feed recent weeks' meal names in as an avoid list so new weeks
    // don't rehash the last one. Strength comes from profile prefs (Phase 3);
    // "medium" until then.
    const variety = varietyParams("medium");
    const recentMealNames = extractRecentMealNames(
      await fetchRecentPlanJsons(userId, target, variety.weeksBack),
      variety.nameCap,
    );
    const planJson = await generateMealPlan({
      profile,
      schedule,
      daysToGenerate: daysToInclude,
      recentMealNames,
      varietyTone: variety.promptTone,
      temperature: variety.temperature,
    });

    const result = await prisma.$transaction(async (tx) => {
      // Deactivate (not delete) existing plans for this week to preserve
      // completions. updateMany keyed on (userId, weekStartDate) keeps the
      // read-modify-write inside this transaction. Two truly concurrent
      // generates can still both commit isActive: true, but readers order
      // by createdAt desc so the outcome stays deterministic — acceptable
      // for a single-user app.
      await tx.weeklyMealPlan.updateMany({
        where: { userId, weekStartDate: target, isActive: true },
        data: { isActive: false },
      });

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

      // Cap storage at the current + next week. Plans (and their grocery
      // lists) for any prior week are pruned; MealCompletion rows survive
      // because the FK was detached from WeeklyMealPlan. Only prune when
      // generating the current week — generating next week must never
      // touch this-week data.
      if (isCurrentWeek) {
        await tx.weeklyMealPlan.deleteMany({
          where: { userId, weekStartDate: { lt: thisWeek } },
        });
        await tx.groceryList.deleteMany({
          where: { userId, weekStartDate: { lt: thisWeek } },
        });
      }

      return { plan };
    });

    // Rebuild grocery list for just the targeted week
    const groceryList = await rebuildGroceries(userId, target);

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
  const isCurrentWeek = target.getTime() === thisWeek.getTime();

  const planJson: MealPlanJson = {
    summary: "Manual plan — add meals from your recipe book or build new ones.",
    dailyCalorieTarget: 0,
    days: ALL_DAYS.map((day) => ({ day, meals: [] })),
  };

  const result = await prisma.$transaction(async (tx) => {
    // Same transactional deactivation pattern as /generate.
    await tx.weeklyMealPlan.updateMany({
      where: { userId, weekStartDate: target, isActive: true },
      data: { isActive: false },
    });

    const plan = await tx.weeklyMealPlan.create({
      data: {
        userId,
        weekStartDate: target,
        planJson: planJson as unknown as object,
        isActive: true,
      },
    });

    // Cap storage at the current + next week. Plans (and grocery lists)
    // for any prior week are pruned; MealCompletion rows survive. Only
    // prune when creating the current week's blank plan.
    if (isCurrentWeek) {
      await tx.weeklyMealPlan.deleteMany({
        where: { userId, weekStartDate: { lt: thisWeek } },
      });
      await tx.groceryList.deleteMany({
        where: { userId, weekStartDate: { lt: thisWeek } },
      });
    }

    return { plan };
  });

  const groceryList = await rebuildGroceries(userId, target);
  res.json({ plan: result.plan, groceryList });
});

const weekStartField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

const slotLocSchema = z.object({
  day: z.enum(DAYS),
  index: z.number().int().nonnegative(),
  weekStart: weekStartField,
});

const slotMealSchema = slotLocSchema.extend({
  meal: mealSchema,
});

const slotAddSchema = z.object({
  day: z.enum(DAYS),
  meal: mealSchema,
  weekStart: weekStartField,
});

const slotRegenSchema = z.object({
  day: z.enum(DAYS),
  index: z.number().int().nonnegative(),
  weekStart: weekStartField,
  suggestion: z.string().max(500).optional(),
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
    // Dependents of the *outgoing* meal — the client asks the user what to
    // do with them (update to new leftovers / regenerate / leave).
    const affectedLeftovers = await collectAffectedLeftovers(
      userId,
      parsed.data.weekStart,
      parsed.data.day,
      parsed.data.index,
    );
    const { plan } = await mutatePlanForWeek(
      userId,
      parsed.data.weekStart,
      (planJson) => {
        const day = planJson.days.find((d) => d.day === parsed.data.day);
        if (!day) throw new Error("Day not found in plan");
        if (parsed.data.index >= day.meals.length) {
          day.meals.push(parsed.data.meal);
        } else {
          day.meals[parsed.data.index] = parsed.data.meal;
        }
        return planJson;
      },
      [{ day: parsed.data.day, op: { type: "recount" } }],
    );
    const groceryList = await rebuildGroceries(userId, plan.weekStartDate);
    res.json({
      plan: { ...plan, planJson: normalizeMealPlan(plan.planJson) },
      groceryList,
      affectedLeftovers,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

interface AffectedLeftover {
  day: DayLabel;
  index: number;
  name: string;
  sourceName: string;
  /** Slot of the replaced source meal — lets the client find its successor. */
  sourceSlot?: string;
}

/**
 * Leftover meals that depended on the meal at (day, index) before a
 * mutation replaced it. Empty when the source had no dependents.
 */
async function collectAffectedLeftovers(
  userId: string,
  weekStart: string | undefined,
  day: DayLabel,
  index: number,
): Promise<AffectedLeftover[]> {
  const target = weekStart
    ? await findMealPlanForWeek(userId, parseLocalDate(weekStart))
    : await findCurrentWeekMealPlan(userId, await getUserWeekStartDay(userId));
  if (!target) return [];
  const planJson = normalizeMealPlan(target.planJson);
  const source = planJson.days.find((d) => d.day === day)?.meals[index];
  if (!source) return [];
  return findDependentLeftovers(planJson, day, index).map((dep) => ({
    day: dep.day,
    index: dep.index,
    name: dep.meal.name,
    sourceName: source.name,
    sourceSlot: source.slot,
  }));
}

// Append a meal to a day (e.g., add a snack).
router.post("/slot/add", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = slotAddSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const { plan } = await mutatePlanForWeek(
      userId,
      parsed.data.weekStart,
      (planJson) => {
        const day = planJson.days.find((d) => d.day === parsed.data.day);
        if (!day) throw new Error("Day not found in plan");
        day.meals.push(parsed.data.meal);
        return planJson;
      },
      [{ day: parsed.data.day, op: { type: "recount" } }],
    );
    const groceryList = await rebuildGroceries(userId, plan.weekStartDate);
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
    const { plan } = await mutatePlanForWeek(
      userId,
      parsed.data.weekStart,
      (planJson) => {
        const day = planJson.days.find((d) => d.day === parsed.data.day);
        if (!day) throw new Error("Day not found in plan");
        if (parsed.data.index >= day.meals.length) {
          throw new Error("No meal at that index");
        }
        day.meals.splice(parsed.data.index, 1);
        return planJson;
      },
      [{ day: parsed.data.day, op: { type: "remove", index: parsed.data.index } }],
    );
    const groceryList = await rebuildGroceries(userId, plan.weekStartDate);
    res.json({
      plan: { ...plan, planJson: normalizeMealPlan(plan.planJson) },
      groceryList,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Regenerate a single meal at (day, index) using Gemini.
router.post("/slot/regenerate", requireAuth, generationLimiter, async (req, res) => {
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
  const targetPlan = parsed.data.weekStart
    ? await findMealPlanForWeek(userId, parseLocalDate(parsed.data.weekStart))
    : await findCurrentWeekMealPlan(userId, await getUserWeekStartDay(userId));
  if (!targetPlan) {
    res.status(404).json({ error: "No active meal plan" });
    return;
  }
  const planJson = normalizeMealPlan(targetPlan.planJson);
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
    const affectedLeftovers = findDependentLeftovers(
      planJson,
      parsed.data.day,
      parsed.data.index,
    ).map((dep) => ({
      day: dep.day,
      index: dep.index,
      name: dep.meal.name,
      sourceName: existing?.name ?? "",
      sourceSlot: existing?.slot,
    }));
    const weekAvoid = collectWeekAvoidNames(planJson, {
      day: parsed.data.day,
      index: parsed.data.index,
    });
    const newMeal: MealJson = await generateSingleMeal({
      profile,
      slot,
      targetCalories: remainingCal,
      targetProteinG: remainingProtein,
      avoidNames: existing ? [existing.name, ...weekAvoid] : weekAvoid,
      userSuggestion: parsed.data.suggestion,
    });

    const { plan } = await mutatePlanForWeek(
      userId,
      parsed.data.weekStart,
      (json) => {
        const dEntry = json.days.find((d) => d.day === parsed.data.day);
        if (!dEntry) throw new Error("Day not found in plan");
        if (parsed.data.index >= dEntry.meals.length) {
          dEntry.meals.push(newMeal);
        } else {
          dEntry.meals[parsed.data.index] = newMeal;
        }
        return json;
      },
      [{ day: parsed.data.day, op: { type: "recount" } }],
    );
    const groceryList = await rebuildGroceries(userId, plan.weekStartDate);
    res.json({
      plan: { ...plan, planJson: normalizeMealPlan(plan.planJson) },
      groceryList,
      affectedLeftovers,
    });
  } catch (err) {
    const message = getGeminiErrorMessage(err);
    console.error("[meals] slot regenerate failed:", message);
    res
      .status(503)
      .json({ error: "Failed to regenerate meal", detail: message });
  }
});

const dayRegenSchema = z.object({
  day: z.enum(DAYS),
  weekStart: weekStartField,
  suggestion: z.string().max(500).optional(),
});

// Regenerate all meals for a single day using Gemini.
router.post("/regenerate-day", requireAuth, generationLimiter, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = dayRegenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) {
    res.status(400).json({ error: "Create a profile first" });
    return;
  }

  const targetPlan = parsed.data.weekStart
    ? await findMealPlanForWeek(userId, parseLocalDate(parsed.data.weekStart))
    : await findCurrentWeekMealPlan(userId, await getUserWeekStartDay(userId));
  if (!targetPlan) {
    res.status(404).json({ error: "No active meal plan" });
    return;
  }

  try {
    const schedule = await getTrainingSchedule(userId);
    const variety = varietyParams("medium");
    const recentMealNames = extractRecentMealNames(
      await fetchRecentPlanJsons(userId, targetPlan.weekStartDate, variety.weeksBack),
      variety.nameCap,
    );
    const freshPlanJson = await generateMealPlan({
      profile,
      schedule,
      daysToGenerate: [parsed.data.day],
      userSuggestion: parsed.data.suggestion,
      recentMealNames,
      varietyTone: variety.promptTone,
      temperature: variety.temperature,
    });

    const freshDay = freshPlanJson.days.find((d) => d.day === parsed.data.day);
    if (!freshDay) {
      res.status(503).json({ error: "Generated plan did not include the requested day" });
      return;
    }

    // Leftovers on OTHER days that depended on any meal of the replaced day.
    const oldPlanJson = normalizeMealPlan(targetPlan.planJson);
    const oldDay = oldPlanJson.days.find((d) => d.day === parsed.data.day);
    const seen = new Set<string>();
    const affectedLeftovers: AffectedLeftover[] = [];
    (oldDay?.meals ?? []).forEach((sourceMeal, i) => {
      for (const dep of findDependentLeftovers(oldPlanJson, parsed.data.day, i)) {
        if (dep.day === parsed.data.day) continue;
        const key = `${dep.day}:${dep.index}`;
        if (seen.has(key)) continue;
        seen.add(key);
        affectedLeftovers.push({
          day: dep.day,
          index: dep.index,
          name: dep.meal.name,
          sourceName: sourceMeal.name,
          sourceSlot: sourceMeal.slot,
        });
      }
    });

    const { plan } = await mutatePlanForWeek(
      userId,
      parsed.data.weekStart,
      (planJson) => {
        const existingDay = planJson.days.find((d) => d.day === parsed.data.day);
        if (existingDay) {
          existingDay.meals = freshDay.meals;
        } else {
          planJson.days.push(freshDay);
        }
        return planJson;
      },
      // The day's meals were wholly replaced — old completion indices no
      // longer refer to anything meaningful.
      [{ day: parsed.data.day, op: { type: "clearDay" } }],
    );

    const groceryList = await rebuildGroceries(userId, plan.weekStartDate);
    res.json({
      plan: { ...plan, planJson: normalizeMealPlan(plan.planJson) },
      groceryList,
      affectedLeftovers,
    });
  } catch (err) {
    const message = getGeminiErrorMessage(err);
    console.error("[meals] regenerate-day failed:", message);
    res.status(503).json({ error: "Failed to regenerate day", detail: message });
  }
});

const resolveLeftoversSchema = z.object({
  weekStart: weekStartField,
  /** The (new) source meal the leftovers should follow when action=update. */
  source: z.object({ day: z.enum(DAYS), index: z.number().int().nonnegative() }),
  cells: z
    .array(z.object({ day: z.enum(DAYS), index: z.number().int().nonnegative() }))
    .min(1)
    .max(8),
  action: z.enum(["update", "regenerate"]),
});

// Resolve dangling leftover meals after their source changed. "update" turns
// each cell into leftovers of the new source; "regenerate" replaces each
// with a fresh Gemini meal. ("Leave as is" = the client simply doesn't call.)
router.post("/leftovers/resolve", requireAuth, generationLimiter, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = resolveLeftoversSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) {
    res.status(400).json({ error: "Create a profile first" });
    return;
  }

  try {
    let freshMeals: Array<{ cell: { day: DayLabel; index: number }; meal: MealJson }> = [];
    if (parsed.data.action === "regenerate") {
      const targetPlan = parsed.data.weekStart
        ? await findMealPlanForWeek(userId, parseLocalDate(parsed.data.weekStart))
        : await findCurrentWeekMealPlan(userId, await getUserWeekStartDay(userId));
      if (!targetPlan) {
        res.status(404).json({ error: "No active meal plan" });
        return;
      }
      const planJson = normalizeMealPlan(targetPlan.planJson);
      // Sequential per-cell generation: leftover repairs touch 1-2 cells in
      // practice (capped at 8), and sequencing keeps rate limits simple.
      for (const cell of parsed.data.cells) {
        const dayEntry = planJson.days.find((d) => d.day === cell.day);
        const existing = dayEntry?.meals[cell.index];
        if (!dayEntry || !existing) continue;
        const slot = pickSlot(existing, cell.index);
        const dayTargetCal = planJson.dailyCalorieTarget || profile.caloricTarget || 0;
        const otherMeals = dayEntry.meals.filter((_, i) => i !== cell.index);
        const otherCal = otherMeals.reduce((s, m) => s + m.calories, 0);
        const otherProtein = otherMeals.reduce((s, m) => s + m.proteinG, 0);
        const meal = await generateSingleMeal({
          profile,
          slot,
          targetCalories: dayTargetCal ? Math.max(200, Math.round(dayTargetCal - otherCal)) : undefined,
          targetProteinG: profile.proteinTargetG
            ? Math.max(15, Math.round(profile.proteinTargetG - otherProtein))
            : undefined,
          avoidNames: [existing.name, ...collectWeekAvoidNames(planJson, cell)],
        });
        // A regenerated meal is fresh — never a leftover of anything.
        freshMeals.push({
          cell,
          meal: { ...meal, isLeftover: undefined, leftoverOf: undefined },
        });
      }
    }

    const { plan } = await mutatePlanForWeek(
      userId,
      parsed.data.weekStart,
      (planJson) => {
        if (parsed.data.action === "update") {
          for (const cell of parsed.data.cells) {
            applyLeftoverUpdate(planJson, cell, parsed.data.source);
          }
        } else {
          for (const { cell, meal } of freshMeals) {
            const dayEntry = planJson.days.find((d) => d.day === cell.day);
            if (dayEntry && cell.index < dayEntry.meals.length) {
              dayEntry.meals[cell.index] = meal;
            }
          }
        }
        return planJson;
      },
      [...new Set(parsed.data.cells.map((c) => c.day))].map((day) => ({
        day,
        op: { type: "recount" as const },
      })),
    );

    const groceryList = await rebuildGroceries(userId, plan.weekStartDate);
    res.json({
      plan: { ...plan, planJson: normalizeMealPlan(plan.planJson) },
      groceryList,
    });
  } catch (err) {
    const message = getGeminiErrorMessage(err);
    console.error("[meals] leftovers/resolve failed:", message);
    res.status(503).json({ error: "Failed to update leftovers", detail: message });
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

async function mutatePlanForWeek(
  userId: string,
  weekStart: string | undefined,
  mutator: (json: MealPlanJson) => MealPlanJson,
  reconcile?: Array<{ day: DayLabel; op: ReconcileOp }>,
) {
  const target = weekStart
    ? await findMealPlanForWeek(userId, parseLocalDate(weekStart))
    : await findCurrentWeekMealPlan(userId, await getUserWeekStartDay(userId));
  if (!target) {
    throw new Error("No meal plan for the requested week");
  }
  const next = mutator(normalizeMealPlan(target.planJson));

  const updated = await prisma.$transaction(async (tx) => {
    const plan = await tx.weeklyMealPlan.update({
      where: { id: target.id },
      data: { planJson: next as unknown as object },
    });

    // Keep completion indices for each mutated day pointing at the right
    // meals (e.g. deleting meal 0 shifts the rest down by one).
    if (reconcile?.length) {
      const completions = await tx.mealCompletion.findMany({
        where: { userId, planId: target.id },
      });
      for (const entry of reconcile) {
        const newMealCount =
          next.days.find((d) => d.day === entry.day)?.meals.length ?? 0;
        for (const row of completions) {
          if (dayLabelForDayKey(row.dayKey) !== entry.day) continue;
          const current = Array.isArray(row.indicesJson)
            ? (row.indicesJson as number[])
            : [];
          const result = reconcileIndices(current, entry.op, newMealCount);
          const completedAt = result.complete
            ? (row.completedAt ?? new Date())
            : null;
          const indicesChanged =
            result.indices.length !== current.length ||
            result.indices.some((v, i) => v !== current[i]);
          if (indicesChanged || (completedAt?.getTime() ?? null) !== (row.completedAt?.getTime() ?? null)) {
            await tx.mealCompletion.update({
              where: { id: row.id },
              data: { indicesJson: result.indices, completedAt },
            });
          }
        }
      }
    }

    return plan;
  });
  return { plan: updated };
}

/**
 * Rebuild the grocery list for a specific week from that week's meal plan.
 * Each (userId, weekStartDate) gets its own grocery list. Manual items and
 * check state on the existing list are preserved.
 */
export async function rebuildGroceries(userId: string, weekStartDate: Date) {
  const plan = await findMealPlanForWeek(userId, weekStartDate);
  const fresh: GroceryItem[] = plan
    ? buildGroceryItems(normalizeMealPlan(plan.planJson))
    : [];

  const existing = await prisma.groceryList.findUnique({
    where: { userId_weekStartDate: { userId, weekStartDate } },
  });
  const merged = mergeGroceryItems(
    fresh,
    Array.isArray(existing?.items) ? (existing!.items as never) : [],
  );

  if (existing) {
    return prisma.groceryList.update({
      where: { id: existing.id },
      data: {
        items: merged as unknown as object,
        weeklyMealPlanId: plan?.id ?? null,
      },
    });
  }
  return prisma.groceryList.create({
    data: {
      userId,
      weekStartDate,
      weeklyMealPlanId: plan?.id ?? null,
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
    plan = await findCurrentWeekMealPlan(userId, await getUserWeekStartDay(userId));
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
  const { planId, dayKey, indices } = parsed.data;

  // Verify plan belongs to user
  const plan = await prisma.weeklyMealPlan.findFirst({
    where: { id: planId, userId },
  });
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  // Derive completion state from the plan — never trust client counts.
  const planJson = normalizeMealPlan(plan.planJson);
  const dayLabel = dayLabelForDayKey(dayKey);
  const mealCount =
    planJson.days.find((d) => d.day === dayLabel)?.meals.length ?? 0;
  const existing = await prisma.mealCompletion.findUnique({
    where: { userId_planId_dayKey: { userId, planId, dayKey } },
  });
  const result = validateMealCompletion({
    dayKey,
    weekStartDate: plan.weekStartDate,
    mealCount,
    indices,
    previousCompletedAt: existing?.completedAt ?? null,
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  const completion = await prisma.mealCompletion.upsert({
    where: { userId_planId_dayKey: { userId, planId, dayKey } },
    update: { indicesJson: result.indices, completedAt: result.completedAt },
    create: {
      userId,
      planId,
      dayKey,
      indicesJson: result.indices,
      completedAt: result.completedAt,
    },
  });
  res.json({ completion });
});

export default router;
