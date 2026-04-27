interface StreakInput {
  workoutDates: Set<string>; // YYYY-MM-DD dates where workout was fully completed
  mealDates: Set<string>;    // YYYY-MM-DD dates where all meals were completed
  hydrationDates: Set<string>; // YYYY-MM-DD dates where hydration goal was met
  restDays: Set<string>;     // YYYY-MM-DD dates that are rest days (skip for workout streak)
}

interface StreakResult {
  current: number;
  best: number;
}

interface StreaksOutput {
  workout: StreakResult;
  meals: StreakResult;
  hydration: StreakResult;
  overall: StreakResult;
}

/**
 * Walk backwards from today counting consecutive days where each goal was met.
 * Rest days are excluded from the workout streak (they don't break it).
 */
export function computeStreaks(input: StreakInput): StreaksOutput {
  const workout = computeStreak(input.workoutDates, input.restDays);
  const meals = computeStreak(input.mealDates);
  const hydration = computeStreak(input.hydrationDates);

  // Overall = all three hit on the same day (rest days count as workout-done for overall)
  const overallDates = new Set<string>();
  const allDates = new Set([...input.workoutDates, ...input.mealDates, ...input.hydrationDates, ...input.restDays]);
  for (const dk of allDates) {
    const workoutOk = input.workoutDates.has(dk) || input.restDays.has(dk);
    const mealOk = input.mealDates.has(dk);
    const hydrationOk = input.hydrationDates.has(dk);
    if (workoutOk && mealOk && hydrationOk) overallDates.add(dk);
  }
  const overall = computeStreak(overallDates);

  return { workout, meals, hydration, overall };
}

function computeStreak(
  completedDates: Set<string>,
  skipDays?: Set<string>,
): StreakResult {
  let current = 0;
  let best = 0;
  let streak = 0;
  let foundCurrent = false;

  const cursor = new Date();
  for (let i = 0; i < 90; i++) {
    const dk = dayKey(cursor);

    if (skipDays?.has(dk)) {
      // Skip day doesn't break streak, just skip it
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }

    if (completedDates.has(dk)) {
      streak++;
      if (!foundCurrent) current = streak;
    } else {
      if (!foundCurrent) {
        // If today isn't done yet, that's okay — check yesterday
        if (i === 0) {
          cursor.setDate(cursor.getDate() - 1);
          continue;
        }
        foundCurrent = true;
        current = streak;
      }
      best = Math.max(best, streak);
      streak = 0;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  best = Math.max(best, streak);
  if (!foundCurrent) current = streak;

  return { current, best: Math.max(best, current) };
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
