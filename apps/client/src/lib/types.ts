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
  source?: "auto" | "manual";
  amount?: number;
  unit?: string;
  note?: string;
}

export interface GroceryList {
  id: string;
  userId: string;
  weeklyMealPlanId: string | null;
  items: GroceryItem[];
  pushedToRemindersAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

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
  /**
   * Canonical units: "g", "kg", "oz", "lb", "ml", "L", "tsp", "tbsp", "cup",
   * "fl oz", "piece", "slice", "clove", "can", "pinch", "to taste", "".
   * Display layer formats per user's unit system.
   */
  unit: string;
  /** Optional pre-formatted override (used when amounts can't be combined cleanly). */
  display?: string;
}

export interface Ingredient {
  name: string;
  quantity: Quantity;
  category?: GroceryCategory;
  note?: string;
}

export interface RecipeStep {
  order: number;
  text: string;
  durationMinutes?: number;
}

export interface Meal {
  name: string;
  slot?: MealSlot;
  servings: number;
  prepMinutes?: number;
  cookMinutes?: number;
  totalMinutes?: number;
  calories: number;
  proteinG: number;
  carbsG?: number;
  fatG?: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  tags?: string[];
  notes?: string;
  isLeftover?: boolean;
}

export interface MealDay {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  meals: Meal[];
}

export interface MealPlanJson {
  summary: string;
  dailyCalorieTarget: number;
  days: MealDay[];
}

export interface WeeklyMealPlanRecord {
  id: string;
  userId: string;
  weekStartDate: string;
  planJson: MealPlanJson;
  isActive: boolean;
  createdAt: string;
}

export type RecipeSource = "MANUAL" | "AI";

export interface RecipeRecord {
  id: string;
  userId: string;
  name: string;
  slotHint: MealSlot | null;
  category: RecipeCategory;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  calories: number;
  proteinG: number;
  carbsG: number | null;
  fatG: number | null;
  ingredientsJson: Ingredient[];
  stepsJson: RecipeStep[];
  tags: string[];
  source: RecipeSource;
  notes: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeInput {
  name: string;
  slotHint?: MealSlot | null;
  category?: RecipeCategory;
  servings: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  totalMinutes?: number | null;
  calories: number;
  proteinG: number;
  carbsG?: number | null;
  fatG?: number | null;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  tags?: string[];
  notes?: string | null;
}

export interface ActivityLog {
  id: string;
  userId: string;
  activityName: string;
  performedAt: string;
  durationMinutes: number | null;
  activeCalories: number | null;
  distanceMiles: number | null;
  note: string | null;
  createdAt: string;
}

export interface ActivityInput {
  activityName: string;
  performedAt: string;
  durationMinutes?: number | null;
  activeCalories?: number | null;
  distanceMiles?: number | null;
  note?: string;
}
