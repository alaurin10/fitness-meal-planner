export interface FitSchedule {
  trainingDays: string[];
  avgDailyCaloriesBurned: number;
  goal: string | null;
}

const DEFAULT_SCHEDULE: FitSchedule = {
  trainingDays: [],
  avgDailyCaloriesBurned: 0,
  goal: null,
};

export async function fetchFitSchedule(userId: string): Promise<FitSchedule> {
  const base = process.env.FIT_INTERNAL_URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!base || !secret) {
    console.warn("[meals] fit internal URL or secret missing, skipping");
    return DEFAULT_SCHEDULE;
  }
  try {
    const res = await fetch(
      `${base}/internal/schedule?userId=${encodeURIComponent(userId)}`,
      { headers: { "x-internal-secret": secret } },
    );
    if (!res.ok) {
      console.warn(`[meals] fit internal returned ${res.status}`);
      return DEFAULT_SCHEDULE;
    }
    return (await res.json()) as FitSchedule;
  } catch (err) {
    console.warn("[meals] fit internal fetch failed:", err);
    return DEFAULT_SCHEDULE;
  }
}
