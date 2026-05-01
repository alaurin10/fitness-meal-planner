// Bodyweight exercises (loadLbs == null) fall back to a fraction of the
// user's profile weight — averages pushing/pulling movements that don't load
// 100% bodyweight (push-ups, dips, etc.). See Progress feature design.
const BODYWEIGHT_FACTOR = 0.5;

interface PlanExercise {
  loadLbs?: number | null;
  reps?: string | null;
}

/** Midpoint of a rep string like "8-10" → 9, "5" → 5. Returns 0 if unparseable. */
export function parseRepsForVolume(reps: string | null | undefined): number {
  if (!reps) return 0;
  const matches = reps.match(/\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return 0;
  const nums = matches.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return 0;
  if (nums.length === 1) return nums[0]!;
  return (nums[0]! + nums[1]!) / 2;
}

/** lbs lifted per rep for a single exercise, accounting for bodyweight fallback. */
function loadPerRepLbs(
  loadLbs: number | null | undefined,
  profileWeightLbs: number | null | undefined,
): number {
  if (loadLbs != null && loadLbs > 0) return loadLbs;
  if (profileWeightLbs != null && profileWeightLbs > 0) {
    return profileWeightLbs * BODYWEIGHT_FACTOR;
  }
  return 0;
}

// `completedSets` is the WorkoutCompletion.setsJson shape:
// Record<exerciseIdx, completedSetNumbers[]>. Only the array length is used —
// the actual set numbers aren't needed for a volume sum.
export function computeWorkoutVolumeLbs(args: {
  exercises: PlanExercise[];
  completedSets: Record<string, number[]>;
  profileWeightLbs: number | null | undefined;
}): number {
  const { exercises, completedSets, profileWeightLbs } = args;
  let total = 0;
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i]!;
    const doneCount = completedSets[String(i)]?.length ?? 0;
    if (doneCount === 0) continue;
    const reps = parseRepsForVolume(ex.reps);
    if (reps === 0) continue;
    const perRep = loadPerRepLbs(ex.loadLbs, profileWeightLbs);
    if (perRep === 0) continue;
    total += perRep * reps * doneCount;
  }
  return Math.round(total);
}
