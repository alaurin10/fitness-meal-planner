import type { GroceryItem } from "@platform/db";

interface MaybeSourced extends GroceryItem {
  source?: "auto" | "manual";
}

/**
 * Merge freshly built auto items with an existing list:
 * - preserves `checked` state for auto items whose normalized (category, name) match
 * - keeps any items previously flagged as `source: "manual"` unchanged
 * - drops auto items that are no longer present in the new build
 *
 * Items without an explicit `source` field are treated as auto (legacy data).
 */
export function mergeGroceryItems(
  freshAuto: GroceryItem[],
  existing: MaybeSourced[],
): MaybeSourced[] {
  const checkedKeys = new Set<string>();
  const manualItems: MaybeSourced[] = [];

  for (const item of existing) {
    if (item.source === "manual") {
      manualItems.push(item);
      continue;
    }
    if (item.checked) {
      checkedKeys.add(key(item));
    }
  }

  const mergedAuto: MaybeSourced[] = freshAuto.map((item) => ({
    ...item,
    source: "auto" as const,
    checked: checkedKeys.has(key(item)) ? true : item.checked,
  }));

  return sortItems([...mergedAuto, ...manualItems]);
}

function key(item: GroceryItem): string {
  return `${item.category}::${item.name.trim().toLowerCase()}`;
}

function sortItems(items: MaybeSourced[]): MaybeSourced[] {
  return [...items].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
}
