-- Move hydrationGoal from UserSettings to Profile

-- AlterTable: add hydrationGoal to Profile
ALTER TABLE "Profile" ADD COLUMN "hydrationGoal" INTEGER NOT NULL DEFAULT 8;

-- Migrate existing data: copy hydrationGoal from UserSettings to Profile
UPDATE "Profile" p
SET "hydrationGoal" = s."hydrationGoal"
FROM "UserSettings" s
WHERE s."userId" = p."userId"
  AND s."hydrationGoal" IS NOT NULL
  AND s."hydrationGoal" != 8;

-- AlterTable: remove hydrationGoal from UserSettings
ALTER TABLE "UserSettings" DROP COLUMN "hydrationGoal";
