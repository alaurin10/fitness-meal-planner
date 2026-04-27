import { PrismaClient, Prisma } from "../generated/index.js";

export { Prisma };

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export type {
  User,
  Profile,
  WeeklyPlan,
  WeeklyMealPlan,
  GroceryList,
  ProgressLog,
  Recipe,
  WorkoutCompletion,
  MealCompletion,
  HydrationLog,
} from "../generated/index.js";

export const GROCERY_CATEGORIES = [
  "Produce",
  "Protein",
  "Dairy",
  "Pantry",
  "Frozen",
  "Other",
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

// Pre-made categories for organizing the recipe book. The first four
// align with MEAL_SLOTS so AI-saved recipes can carry their slot
// straight into a category. The rest are broader buckets.
export const RECIPE_CATEGORIES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
  "baking",
  "drinks",
  "sides",
  "other",
] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export interface Quantity {
  amount: number;
  unit: string;
  display?: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  qty: string;
  category: GroceryCategory;
  checked: boolean;
  pushed: boolean;
  source?: "auto" | "manual";
  amount?: number;
  unit?: string;
  note?: string;
}
