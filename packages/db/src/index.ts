import { PrismaClient as FitPrismaClient } from "../generated/fit/index.js";
import { PrismaClient as MealsPrismaClient, Prisma as MealsPrisma } from "../generated/meals/index.js";

export { MealsPrisma };

declare global {
  // eslint-disable-next-line no-var
  var __fitPrisma: FitPrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __mealsPrisma: MealsPrismaClient | undefined;
}

export const fitPrisma =
  globalThis.__fitPrisma ??
  new FitPrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

export const mealsPrisma =
  globalThis.__mealsPrisma ??
  new MealsPrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__fitPrisma = fitPrisma;
  globalThis.__mealsPrisma = mealsPrisma;
}

export type {
  User as FitUser,
  FitProfile,
  WeeklyPlan,
  ProgressLog,
} from "../generated/fit/index.js";

export type {
  User as MealsUser,
  MealProfile,
  WeeklyMealPlan,
  GroceryList,
} from "../generated/meals/index.js";

export const GROCERY_CATEGORIES = [
  "Produce",
  "Protein",
  "Dairy",
  "Pantry",
  "Frozen",
  "Other",
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

export interface GroceryItem {
  id: string;
  name: string;
  qty: string;
  category: GroceryCategory;
  checked: boolean;
  pushed: boolean;
}
