-- Add meal-plan style preference and available-equipment list to the Profile.
ALTER TABLE "Profile"
  ADD COLUMN "mealComplexity" TEXT NOT NULL DEFAULT 'varied',
  ADD COLUMN "equipment" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
