import { describe, expect, it } from "vitest";
import { parseLocalDate } from "@platform/shared";
import { historyPlanDateBounds } from "./historyBounds.js";

describe("historyPlanDateBounds", () => {
  it("backs the lower bound up one week so partial-week plans are included", () => {
    const bounds = historyPlanDateBounds("2026-06-10", "2026-06-20");
    expect(bounds.gte).toEqual(parseLocalDate("2026-06-03"));
    expect(bounds.lte).toEqual(parseLocalDate("2026-06-20"));
  });

  it("handles month boundaries", () => {
    const bounds = historyPlanDateBounds("2026-07-03", "2026-07-31");
    expect(bounds.gte).toEqual(parseLocalDate("2026-06-26"));
    expect(bounds.lte).toEqual(parseLocalDate("2026-07-31"));
  });
});
