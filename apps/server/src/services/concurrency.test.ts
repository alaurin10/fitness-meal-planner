import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./concurrency.js";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("mapWithConcurrency", () => {
  it("returns results in input order", async () => {
    const items = [30, 0, 10, 20];
    const results = await mapWithConcurrency(items, 2, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms * 2;
    });
    expect(results).toEqual([60, 0, 20, 40]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await tick();
      inFlight -= 1;
    });
    expect(maxInFlight).toBe(3);
  });

  it("propagates the first rejection and stops starting new items", async () => {
    const started: number[] = [];
    await expect(
      mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 2, async (i) => {
        started.push(i);
        await tick();
        if (i === 1) throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    // Workers stop pulling new items once the failure surfaces; the whole
    // list must not have been started.
    expect(started.length).toBeLessThan(10);
  });

  it("handles empty input and limit larger than input", async () => {
    expect(await mapWithConcurrency([], 4, async (x) => x)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 10, async (x) => x + 1)).toEqual([2, 3]);
  });
});
