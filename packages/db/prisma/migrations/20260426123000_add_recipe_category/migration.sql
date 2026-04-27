-- Add a recipe-book category to organize the recipe list.
ALTER TABLE "Recipe"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other';

-- Backfill existing rows: copy slotHint when it matches a known meal-slot
-- category so AI-saved meals don't all land in "other".
UPDATE "Recipe"
SET "category" = "slotHint"
WHERE "slotHint" IN ('breakfast', 'lunch', 'dinner', 'snack');
