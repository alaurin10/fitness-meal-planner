import { type Schema, Type } from "@google/genai";
import { GROCERY_CATEGORIES, MEAL_SLOTS } from "@platform/db";
import { CANONICAL_UNITS } from "./mealPlanSchema.js";

/**
 * Native Gemini response schemas mirroring the Zod schemas in
 * mealPlanSchema.ts / workoutPlanSchema.ts. Passing these as
 * `config.responseSchema` makes the model emit conforming JSON directly,
 * which dramatically reduces malformed/truncated output. Zod validation is
 * still applied afterwards as defense-in-depth.
 *
 * Note: a field is optional simply by omitting it from `required`.
 */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const quantitySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    amount: { type: Type.NUMBER },
    unit: { type: Type.STRING, enum: [...CANONICAL_UNITS] },
  },
  required: ["amount", "unit"],
};

const ingredientSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    quantity: quantitySchema,
    category: { type: Type.STRING, enum: [...GROCERY_CATEGORIES] },
    note: { type: Type.STRING },
  },
  required: ["name", "quantity", "category"],
};

const stepSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    order: { type: Type.INTEGER },
    text: { type: Type.STRING },
    durationMinutes: { type: Type.INTEGER },
  },
  required: ["order", "text"],
};

export const mealResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    slot: { type: Type.STRING, enum: [...MEAL_SLOTS] },
    servings: { type: Type.INTEGER },
    prepMinutes: { type: Type.INTEGER },
    cookMinutes: { type: Type.INTEGER },
    totalMinutes: { type: Type.INTEGER },
    calories: { type: Type.INTEGER },
    proteinG: { type: Type.INTEGER },
    carbsG: { type: Type.INTEGER },
    fatG: { type: Type.INTEGER },
    ingredients: { type: Type.ARRAY, items: ingredientSchema, minItems: "1" },
    steps: { type: Type.ARRAY, items: stepSchema },
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
    notes: { type: Type.STRING },
    isLeftover: { type: Type.BOOLEAN },
  },
  required: ["name", "slot", "servings", "calories", "proteinG", "ingredients", "steps"],
  propertyOrdering: [
    "name",
    "slot",
    "servings",
    "prepMinutes",
    "cookMinutes",
    "totalMinutes",
    "calories",
    "proteinG",
    "carbsG",
    "fatG",
    "ingredients",
    "steps",
    "tags",
    "notes",
    "isLeftover",
  ],
};

const mealPlanDaySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    day: { type: Type.STRING, enum: DAYS },
    meals: { type: Type.ARRAY, items: mealResponseSchema, minItems: "1" },
  },
  required: ["day", "meals"],
};

export const mealPlanResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    dailyCalorieTarget: { type: Type.INTEGER },
    days: { type: Type.ARRAY, items: mealPlanDaySchema, minItems: "1" },
  },
  required: ["summary", "dailyCalorieTarget", "days"],
  propertyOrdering: ["summary", "dailyCalorieTarget", "days"],
};

const exerciseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    muscleGroup: { type: Type.STRING },
    description: { type: Type.STRING },
    sets: { type: Type.INTEGER },
    reps: { type: Type.STRING },
    loadLbs: { type: Type.NUMBER, nullable: true },
    restSeconds: { type: Type.INTEGER },
    notes: { type: Type.STRING },
  },
  required: ["name", "muscleGroup", "description", "sets", "reps", "loadLbs", "restSeconds"],
};

const trainingDaySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    day: { type: Type.STRING, enum: DAYS },
    focus: { type: Type.STRING },
    exercises: { type: Type.ARRAY, items: exerciseSchema, minItems: "1" },
  },
  required: ["day", "focus", "exercises"],
};

export const weeklyPlanResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    progressionNotes: { type: Type.STRING },
    days: { type: Type.ARRAY, items: trainingDaySchema, minItems: "1" },
  },
  required: ["summary", "progressionNotes", "days"],
  propertyOrdering: ["summary", "progressionNotes", "days"],
};
