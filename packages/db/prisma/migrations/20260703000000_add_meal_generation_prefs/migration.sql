-- Meal-generation preferences (decoupled from mealComplexity) + recurring
-- meal-schedule skip template.

ALTER TABLE "Profile" ADD COLUMN "leftoverPreference" TEXT NOT NULL DEFAULT 'occasional';
ALTER TABLE "Profile" ADD COLUMN "varietyStrength" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "Profile" ADD COLUMN "cuisineLikes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Profile" ADD COLUMN "cuisineDislikes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Profile" ADD COLUMN "weeknightMaxMinutes" INTEGER;
ALTER TABLE "Profile" ADD COLUMN "weekendRelaxed" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "UserSettings" ADD COLUMN "mealScheduleJson" JSONB;

-- The "simple" and "prep" complexity styles used to force leftovers via the
-- prompt; carry that behavior into the new dedicated preference so existing
-- users see no change.
UPDATE "Profile" SET "leftoverPreference" = 'often' WHERE "mealComplexity" IN ('simple', 'prep');
