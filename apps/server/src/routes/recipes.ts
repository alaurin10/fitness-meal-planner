import { Router } from "express";
import { z } from "zod";
import { prisma, MEAL_SLOTS } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import {
  ingredientSchema,
  stepSchema,
  type MealJson,
} from "../services/mealPlanSchema.js";
import { normalizeMealPlan } from "../services/mealPlanNormalizer.js";

const router = Router();

const recipeBodySchema = z.object({
  name: z.string().min(1).max(120),
  slotHint: z.enum(MEAL_SLOTS).nullable().optional(),
  servings: z.number().int().min(1).max(50).default(1),
  prepMinutes: z.number().int().nonnegative().nullable().optional(),
  cookMinutes: z.number().int().nonnegative().nullable().optional(),
  totalMinutes: z.number().int().nonnegative().nullable().optional(),
  calories: z.number().int().positive(),
  proteinG: z.number().int().nonnegative(),
  carbsG: z.number().int().nonnegative().nullable().optional(),
  fatG: z.number().int().nonnegative().nullable().optional(),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(stepSchema).min(1),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  notes: z.string().max(2000).nullable().optional(),
});

const recipePatchSchema = recipeBodySchema.partial().extend({
  isFavorite: z.boolean().optional(),
});

const fromMealSchema = z.object({
  day: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
  index: z.number().int().nonnegative(),
  planId: z.string().optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const search = String(req.query.search ?? "").trim();
  const favorite = req.query.favorite === "true";
  const source = String(req.query.source ?? "").toUpperCase();
  const tag = String(req.query.tag ?? "").trim();

  const where: Record<string, unknown> = { userId };
  if (favorite) where.isFavorite = true;
  if (source === "MANUAL" || source === "AI") where.source = source;
  if (tag) where.tags = { has: tag };
  if (search) where.name = { contains: search, mode: "insensitive" };

  const recipes = await prisma.recipe.findMany({
    where,
    orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
  });
  res.json({ recipes });
});

router.get("/:id", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const id = String(req.params.id);
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId },
  });
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  res.json({ recipe });
});

router.post("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = recipeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });
  const data = parsed.data;
  const total =
    data.totalMinutes ??
    ((data.prepMinutes ?? 0) + (data.cookMinutes ?? 0) || null);

  const recipe = await prisma.recipe.create({
    data: {
      userId,
      name: data.name,
      slotHint: data.slotHint ?? null,
      servings: data.servings,
      prepMinutes: data.prepMinutes ?? null,
      cookMinutes: data.cookMinutes ?? null,
      totalMinutes: total,
      calories: data.calories,
      proteinG: data.proteinG,
      carbsG: data.carbsG ?? null,
      fatG: data.fatG ?? null,
      ingredientsJson: data.ingredients as unknown as object,
      stepsJson: data.steps as unknown as object,
      tags: data.tags,
      notes: data.notes ?? null,
      source: "MANUAL",
    },
  });
  res.status(201).json({ recipe });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = recipePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const id = String(req.params.id);
  const existing = await prisma.recipe.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  const d = parsed.data;
  const total =
    d.totalMinutes ??
    ((d.prepMinutes ?? existing.prepMinutes ?? 0) +
      (d.cookMinutes ?? existing.cookMinutes ?? 0) || null);

  const recipe = await prisma.recipe.update({
    where: { id: existing.id },
    data: {
      name: d.name ?? undefined,
      slotHint: d.slotHint === undefined ? undefined : d.slotHint,
      servings: d.servings ?? undefined,
      prepMinutes: d.prepMinutes === undefined ? undefined : d.prepMinutes,
      cookMinutes: d.cookMinutes === undefined ? undefined : d.cookMinutes,
      totalMinutes:
        d.prepMinutes !== undefined ||
        d.cookMinutes !== undefined ||
        d.totalMinutes !== undefined
          ? total
          : undefined,
      calories: d.calories ?? undefined,
      proteinG: d.proteinG ?? undefined,
      carbsG: d.carbsG === undefined ? undefined : d.carbsG,
      fatG: d.fatG === undefined ? undefined : d.fatG,
      ingredientsJson: d.ingredients
        ? (d.ingredients as unknown as object)
        : undefined,
      stepsJson: d.steps ? (d.steps as unknown as object) : undefined,
      tags: d.tags ?? undefined,
      notes: d.notes === undefined ? undefined : d.notes,
      isFavorite: d.isFavorite ?? undefined,
    },
  });
  res.json({ recipe });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const id = String(req.params.id);
  const existing = await prisma.recipe.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  await prisma.recipe.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

router.post("/from-meal", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = fromMealSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { day, index, planId } = parsed.data;

  const plan = planId
    ? await prisma.weeklyMealPlan.findFirst({
        where: { id: planId, userId },
      })
    : await prisma.weeklyMealPlan.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: "desc" },
      });
  if (!plan) {
    res.status(404).json({ error: "Meal plan not found" });
    return;
  }

  const planJson = normalizeMealPlan(plan.planJson);
  const dayEntry = planJson.days.find((d) => d.day === day);
  const meal: MealJson | undefined = dayEntry?.meals[index];
  if (!meal) {
    res.status(404).json({ error: "Meal not found at that slot" });
    return;
  }

  const recipe = await prisma.recipe.create({
    data: {
      userId,
      name: meal.name,
      slotHint: meal.slot ?? null,
      servings: meal.servings,
      prepMinutes: meal.prepMinutes ?? null,
      cookMinutes: meal.cookMinutes ?? null,
      totalMinutes: meal.totalMinutes ?? null,
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG ?? null,
      fatG: meal.fatG ?? null,
      ingredientsJson: meal.ingredients as unknown as object,
      stepsJson: meal.steps as unknown as object,
      tags: meal.tags ?? [],
      notes: meal.notes ?? null,
      source: "AI",
    },
  });
  res.status(201).json({ recipe });
});

export default router;
