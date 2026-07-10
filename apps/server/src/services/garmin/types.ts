// Narrow, app-owned view of the Garmin data we consume. sync.ts and
// workoutPush.ts depend only on this interface so tests can mock it and an
// unofficial-API change stays confined to client.ts.

export interface GarminDailySummary {
  steps: number | null;
  totalKilocalories: number | null;
  activeKilocalories: number | null;
  restingHeartRate: number | null;
}

export interface GarminActivitySummary {
  activityId: number;
  activityName: string;
  typeKey: string; // e.g. "running", "strength_training"
  startTimeLocal: string; // "YYYY-MM-DD HH:mm:ss"
  startTimeGMT: string;
  durationSeconds: number | null;
  distanceMeters: number | null;
  calories: number | null;
}

export interface GarminWeighIn {
  samplePk: number;
  dayKey: string; // calendarDate
  weightGrams: number;
}

export interface GarminWorkoutStep {
  exerciseCategory: string | null; // Garmin taxonomy category, null = unmapped
  exerciseName: string | null; // Garmin taxonomy name within the category
  description: string; // always carries the app's exercise name
  reps: number;
  weightLbs: number | null;
  restSeconds: number;
  sets: number;
}

export interface GarminWorkoutPayload {
  name: string;
  description: string;
  steps: GarminWorkoutStep[];
}

export interface GarminApi {
  /** Garmin displayName (GUID-ish handle used in API paths). */
  getDisplayName(): Promise<string>;
  getDailySummary(dayKey: string): Promise<GarminDailySummary>;
  getSleepSeconds(dayKey: string): Promise<number | null>;
  /** Most-recent-first page of activities. */
  getActivities(start: number, limit: number): Promise<GarminActivitySummary[]>;
  getWeighIns(fromDayKey: string, toDayKey: string): Promise<GarminWeighIn[]>;
  pushWeight(lbs: number): Promise<void>;
  createStrengthWorkout(payload: GarminWorkoutPayload): Promise<{ workoutId: string }>;
  scheduleWorkout(workoutId: string, dayKey: string): Promise<void>;
  deleteWorkout(workoutId: string): Promise<void>;
}

export class GarminAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GarminAuthError";
  }
}

export class GarminUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GarminUnavailableError";
  }
}
