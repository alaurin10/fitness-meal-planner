import { z } from "zod";
import { GROCERY_CATEGORIES, MEAL_SLOTS } from "@platform/db";

export const CANONICAL_UNITS = [
  "g",
  "kg",
  "oz",
  "lb",
  "ml",
  "L",
  "tsp",
  "tbsp",
  "cup",
  "fl oz",
  "piece",
  "slice",
  "clove",
  "can",
  "pinch",
  "to taste",
  "",
] as const;

export const quantitySchema = z.object({
  amount: z.number().nonnegative(),
  unit: z.string(),
  display: z.string().optional(),
});

export const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: quantitySchema,
  category: z.enum(GROCERY_CATEGORIES).optional(),
  note: z.string().optional(),
});

export const stepSchema = z.object({
  order: z.number().int().nonnegative(),
  text: z.string().min(1),
  durationMinutes: z.number().int().nonnegative().optional(),
});

export const mealSchema = z.object({
  name: z.string().min(1),
  slot: z.enum(MEAL_SLOTS).optional(),
  servings: z.number().int().positive(),
  prepMinutes: z.number().int().nonnegative().optional(),
  cookMinutes: z.number().int().nonnegative().optional(),
  totalMinutes: z.number().int().nonnegative().optional(),
  calories: z.number().int().positive(),
  proteinG: z.number().int().nonnegative(),
  carbsG: z.number().int().nonnegative().optional(),
  fatG: z.number().int().nonnegative().optional(),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(stepSchema).min(1),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const daySchema = z.object({
  day: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
  meals: z.array(mealSchema).min(1),
});

export const mealPlanSchema = z.object({
  summary: z.string().min(1),
  dailyCalorieTarget: z.number().int().positive(),
  days: z.array(daySchema).min(1),
});

export type MealPlanJson = z.infer<typeof mealPlanSchema>;
export type MealJson = z.infer<typeof mealSchema>;
export type IngredientJson = z.infer<typeof ingredientSchema>;
export type QuantityJson = z.infer<typeof quantitySchema>;
export type StepJson = z.infer<typeof stepSchema>;
