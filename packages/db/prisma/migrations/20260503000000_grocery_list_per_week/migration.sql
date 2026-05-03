-- Add weekStartDate to GroceryList, scoping each list to one week.
ALTER TABLE "GroceryList" ADD COLUMN "weekStartDate" TIMESTAMP(3);

-- Backfill from linked WeeklyMealPlan when present.
UPDATE "GroceryList" g
SET "weekStartDate" = p."weekStartDate"
FROM "WeeklyMealPlan" p
WHERE g."weeklyMealPlanId" = p."id"
  AND g."weekStartDate" IS NULL;

-- Fallback: any remaining unlinked rows get the most-recent Monday at-or-before createdAt.
-- Postgres date_trunc on a Mon-based week: subtract days so weekday becomes Monday.
UPDATE "GroceryList"
SET "weekStartDate" = date_trunc('day', "createdAt")
  - ((EXTRACT(ISODOW FROM "createdAt")::int - 1) * INTERVAL '1 day')
WHERE "weekStartDate" IS NULL;

-- Deduplicate: if a user has multiple GroceryList rows for the same week (legacy data),
-- keep only the newest and delete the rest so the unique constraint can be added.
DELETE FROM "GroceryList" g
USING "GroceryList" g2
WHERE g."userId" = g2."userId"
  AND g."weekStartDate" = g2."weekStartDate"
  AND g."createdAt" < g2."createdAt";

-- Now make the column required.
ALTER TABLE "GroceryList" ALTER COLUMN "weekStartDate" SET NOT NULL;

-- Replace the old (userId, createdAt) index with week-scoped indexes.
DROP INDEX IF EXISTS "GroceryList_userId_createdAt_idx";
CREATE UNIQUE INDEX "GroceryList_userId_weekStartDate_key" ON "GroceryList"("userId", "weekStartDate");
CREATE INDEX "GroceryList_userId_weekStartDate_idx" ON "GroceryList"("userId", "weekStartDate");
