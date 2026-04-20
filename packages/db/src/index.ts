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

export interface GroceryItem {
  id: string;
  name: string;
  qty: string;
  category: GroceryCategory;
  checked: boolean;
  pushed: boolean;
}
