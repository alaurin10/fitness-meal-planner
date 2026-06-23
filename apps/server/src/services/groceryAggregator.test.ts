import { describe, expect, it } from "vitest";
import { buildGroceryItems } from "./groceryAggregator.js";
import type { IngredientJson, MealJson, MealPlanJson } from "./mealPlanSchema.js";

function ing(
  name: string,
  amount: number,
  unit: string,
  category?: IngredientJson["category"],
): IngredientJson {
  return { name, quantity: { amount, unit }, ...(category ? { category } : {}) };
}

function meal(
  name: string,
  ingredients: IngredientJson[],
  extra: Partial<MealJson> = {},
): MealJson {
  return {
    name,
    servings: 1,
    calories: 400,
    proteinG: 30,
    ingredients,
    steps: [],
    ...extra,
  };
}

function plan(days: MealPlanJson["days"]): MealPlanJson {
  return { summary: "test", dailyCalorieTarget: 2000, days };
}

function findItem(items: ReturnType<typeof buildGroceryItems>, name: string) {
  return items.find((i) => i.name.toLowerCase() === name.toLowerCase());
}

describe("buildGroceryItems — recipe tracking", () => {
  it("records the contributing meal with name, day, and slot", () => {
    const items = buildGroceryItems(
      plan([
        {
          day: "Mon",
          meals: [
            meal("Grilled Chicken Salad", [ing("Chicken Breast", 200, "g", "Protein")], {
              slot: "lunch",
            }),
          ],
        },
      ]),
    );
    const chicken = findItem(items, "chicken breast");
    expect(chicken?.recipes).toEqual([
      { name: "Grilled Chicken Salad", day: "Mon", slot: "lunch" },
    ]);
  });

  it("aggregates the same ingredient across two days, deduped and day-ordered", () => {
    const items = buildGroceryItems(
      plan([
        {
          day: "Wed",
          meals: [meal("Stir Fry", [ing("Rice", 1, "cup", "Pantry")], { slot: "dinner" })],
        },
        {
          day: "Mon",
          meals: [meal("Burrito Bowl", [ing("Rice", 1, "cup", "Pantry")], { slot: "lunch" })],
        },
        // Same dish/day/slot again — must collapse to one entry.
        {
          day: "Mon",
          meals: [meal("Burrito Bowl", [ing("Rice", 1, "cup", "Pantry")], { slot: "lunch" })],
        },
      ]),
    );
    const rice = findItem(items, "rice");
    expect(rice?.recipes).toEqual([
      { name: "Burrito Bowl", day: "Mon", slot: "lunch" },
      { name: "Stir Fry", day: "Wed", slot: "dinner" },
    ]);
  });

  it("links both meals when names normalize to the same ingredient", () => {
    const items = buildGroceryItems(
      plan([
        {
          day: "Mon",
          meals: [meal("Salad", [ing("grilled chicken", 100, "g", "Protein")])],
        },
        {
          day: "Tue",
          meals: [meal("Wrap", [ing("chicken", 100, "g", "Protein")])],
        },
      ]),
    );
    const chicken = findItem(items, "chicken");
    expect(chicken?.recipes?.map((r) => r.name).sort()).toEqual(["Salad", "Wrap"]);
  });

  it('records a "to taste"-only contribution even when a real quantity already exists', () => {
    const items = buildGroceryItems(
      plan([
        {
          day: "Mon",
          meals: [meal("Soup", [ing("Salt", 1, "tsp", "Pantry")])],
        },
        {
          day: "Tue",
          // "to taste" hits the no-op quantity branch; recipe capture must still run.
          meals: [meal("Stew", [ing("Salt", 0, "to taste", "Pantry")])],
        },
      ]),
    );
    const salt = findItem(items, "salt");
    expect(salt?.recipes?.map((r) => r.name).sort()).toEqual(["Soup", "Stew"]);
  });

  it("lists both meals when quantities use incompatible units (displayParts branch)", () => {
    const items = buildGroceryItems(
      plan([
        {
          day: "Mon",
          meals: [meal("Pasta", [ing("Tomato", 2, "piece", "Produce")])],
        },
        {
          day: "Tue",
          meals: [meal("Sauce", [ing("Tomato", 200, "g", "Produce")])],
        },
      ]),
    );
    const tomato = findItem(items, "tomato");
    expect(tomato?.recipes?.map((r) => r.name).sort()).toEqual(["Pasta", "Sauce"]);
  });

  it("does not list leftover meals as a contributing recipe", () => {
    const items = buildGroceryItems(
      plan([
        {
          day: "Mon",
          meals: [meal("Roast Chicken", [ing("Chicken Breast", 200, "g", "Protein")])],
        },
        {
          day: "Tue",
          meals: [
            meal("Roast Chicken (leftovers)", [ing("Chicken Breast", 200, "g", "Protein")], {
              isLeftover: true,
            }),
          ],
        },
      ]),
    );
    const chicken = findItem(items, "chicken breast");
    expect(chicken?.recipes).toEqual([{ name: "Roast Chicken", day: "Mon" }]);
  });
});
