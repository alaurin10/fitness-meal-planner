/**
 * Keep stored MealCompletion indices consistent when the underlying plan
 * mutates. Without this, deleting meal 0 of a day would silently shift every
 * remaining completion onto the wrong meal, skewing calorie/protein
 * attribution in progress views.
 */

export type ReconcileOp =
  | { type: "remove"; index: number }
  | { type: "clearDay" }
  | { type: "recount" };

export interface ReconcileResult {
  indices: number[];
  complete: boolean;
}

export function reconcileIndices(
  indices: number[],
  op: ReconcileOp,
  newMealCount: number,
): ReconcileResult {
  let next: number[];
  switch (op.type) {
    case "remove":
      next = indices
        .filter((i) => i !== op.index)
        .map((i) => (i > op.index ? i - 1 : i));
      break;
    case "clearDay":
      next = [];
      break;
    case "recount":
      next = [...indices];
      break;
  }
  // Defensively drop anything out of range for the new plan shape.
  next = [...new Set(next.filter((i) => i >= 0 && i < newMealCount))].sort(
    (a, b) => a - b,
  );
  return {
    indices: next,
    complete: newMealCount > 0 && next.length >= newMealCount,
  };
}
