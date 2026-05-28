import { describe, expect, it } from "vitest";
import type { GroceryItem } from "@platform/db";
import { mergeGroceryItems } from "./groceryMerge.js";

function item(partial: Partial<GroceryItem> & { name: string; category: GroceryItem["category"] }): GroceryItem {
  return {
    id: partial.id ?? `${partial.category}:${partial.name}`,
    name: partial.name,
    qty: partial.qty ?? "1",
    category: partial.category,
    checked: partial.checked ?? false,
    pushed: partial.pushed ?? false,
    source: partial.source,
    amount: partial.amount,
    unit: partial.unit,
    note: partial.note,
  };
}

describe("mergeGroceryItems", () => {
  it("preserves checked state for auto items matching by normalized (category, name)", () => {
    const fresh = [item({ name: "Chicken Breast", category: "Protein" })];
    const existing = [item({ name: "chicken breast", category: "Protein", checked: true })];
    const merged = mergeGroceryItems(fresh, existing);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.checked).toBe(true);
    expect(merged[0]!.source).toBe("auto");
  });

  it("keeps manual items even if absent from the fresh build", () => {
    const fresh = [item({ name: "rice", category: "Pantry" })];
    const existing = [item({ name: "paper towels", category: "Other", source: "manual" })];
    const merged = mergeGroceryItems(fresh, existing);
    const names = merged.map((m) => m.name);
    expect(names).toContain("paper towels");
    expect(names).toContain("rice");
  });

  it("drops auto items no longer present in the fresh build", () => {
    const fresh = [item({ name: "rice", category: "Pantry" })];
    const existing = [
      item({ name: "rice", category: "Pantry", checked: true }),
      item({ name: "old item", category: "Pantry", checked: true }), // auto, gone now
    ];
    const merged = mergeGroceryItems(fresh, existing);
    expect(merged.map((m) => m.name)).toEqual(["rice"]);
  });

  it("sorts by category then name", () => {
    const fresh = [
      item({ name: "spinach", category: "Produce" }),
      item({ name: "apple", category: "Produce" }),
      item({ name: "milk", category: "Dairy" }),
    ];
    const merged = mergeGroceryItems(fresh, []);
    expect(merged.map((m) => `${m.category}/${m.name}`)).toEqual([
      "Dairy/milk",
      "Produce/apple",
      "Produce/spinach",
    ]);
  });

  it("treats existing items without a source as auto (legacy data)", () => {
    const fresh = [item({ name: "eggs", category: "Protein" })];
    const existing = [item({ name: "eggs", category: "Protein", checked: true, source: undefined })];
    const merged = mergeGroceryItems(fresh, existing);
    expect(merged[0]!.checked).toBe(true);
  });
});
