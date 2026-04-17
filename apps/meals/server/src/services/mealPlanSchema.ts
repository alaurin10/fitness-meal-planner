import { z } from "zod";
import { GROCERY_CATEGORIES } from "@platform/db";

export const ingredientSchema = z.object({
  name: z.string().min(1),
  qty: z.string().min(1),
  category: z.enum(GROCERY_CATEGORIES).optional(),
});

export const mealSchema = z.object({
  name: z.string().min(1),
  calories: z.number().int().positive(),
  proteinG: z.number().int().nonnegative(),
  ingredients: z.array(ingredientSchema).min(1),
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
export type IngredientJson = z.infer<typeof ingredientSchema>;
