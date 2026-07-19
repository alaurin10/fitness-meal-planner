-- Workout-generation preferences: session length, session contents, variety.
-- Defaults preserve current behavior (core included, no cardio) except length,
-- which gains an explicit 60-minute target where none existed before.

ALTER TABLE "Profile" ADD COLUMN "workoutDuration" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Profile" ADD COLUMN "workoutTypes" TEXT[] NOT NULL DEFAULT ARRAY['lifts','core']::TEXT[];
ALTER TABLE "Profile" ADD COLUMN "workoutVariety" TEXT NOT NULL DEFAULT 'medium';
