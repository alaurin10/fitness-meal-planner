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

export interface GroceryList {
  id: string;
  userId: string;
  weeklyMealPlanId: string | null;
  items: GroceryItem[];
  pushedToRemindersAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  name: string;
  qty: string;
  category?: GroceryCategory;
}

export interface Meal {
  name: string;
  calories: number;
  proteinG: number;
  ingredients: Ingredient[];
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

export interface MealProfile {
  id: string;
  userId: string;
  caloricTarget: number | null;
  proteinTargetG: number | null;
  dietaryNotes: string | null;
  updatedAt: string;
}

export interface MealProfileInput {
  caloricTarget: number | null;
  proteinTargetG: number | null;
  dietaryNotes: string | null;
}
