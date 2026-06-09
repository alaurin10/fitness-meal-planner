import { describe, expect, it } from "vitest";
import { reconcileIndices } from "./completionReconciler.js";

describe("reconcileIndices — remove", () => {
  it("drops the deleted index and shifts higher indices down", () => {
    // Day had meals [0,1,2], all completed; meal 1 is deleted.
    const result = reconcileIndices([0, 1, 2], { type: "remove", index: 1 }, 2);
    expect(result.indices).toEqual([0, 1]);
    expect(result.complete).toBe(true);
  });

  it("shifts when the deleted meal was not completed", () => {
    // Meals [0,1,2], only 2 completed; meal 0 is deleted → old 2 becomes 1.
    const result = reconcileIndices([2], { type: "remove", index: 0 }, 2);
    expect(result.indices).toEqual([1]);
    expect(result.complete).toBe(false);
  });

  it("removing the only meal leaves an empty, incomplete day", () => {
    const result = reconcileIndices([0], { type: "remove", index: 0 }, 0);
    expect(result.indices).toEqual([]);
    expect(result.complete).toBe(false);
  });

  it("a complete day stays complete after deleting a completed meal", () => {
    const result = reconcileIndices([0, 1], { type: "remove", index: 1 }, 1);
    expect(result.indices).toEqual([0]);
    expect(result.complete).toBe(true);
  });

  it("a complete day becomes incomplete after deleting an uncompleted meal", () => {
    // Meals [0,1,2], completed [0,1]; meal 2... not completed, delete meal 0.
    const result = reconcileIndices([0, 1], { type: "remove", index: 2 }, 2);
    expect(result.indices).toEqual([0, 1]);
    expect(result.complete).toBe(true);
  });
});

describe("reconcileIndices — clearDay", () => {
  it("resets indices and completeness", () => {
    const result = reconcileIndices([0, 1, 2], { type: "clearDay" }, 3);
    expect(result.indices).toEqual([]);
    expect(result.complete).toBe(false);
  });
});

describe("reconcileIndices — recount", () => {
  it("keeps indices and flips complete off when a meal is added", () => {
    // Day was complete with 2 meals; a third was appended.
    const result = reconcileIndices([0, 1], { type: "recount" }, 3);
    expect(result.indices).toEqual([0, 1]);
    expect(result.complete).toBe(false);
  });

  it("flips complete on when indices now cover the day", () => {
    const result = reconcileIndices([0, 1], { type: "recount" }, 2);
    expect(result.complete).toBe(true);
  });

  it("drops indices that are out of range for the new shape", () => {
    const result = reconcileIndices([0, 5], { type: "recount" }, 2);
    expect(result.indices).toEqual([0]);
    expect(result.complete).toBe(false);
  });
});
