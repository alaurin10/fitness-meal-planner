-- Add weekStartDay to UserSettings
ALTER TABLE "UserSettings" ADD COLUMN "weekStartDay" TEXT NOT NULL DEFAULT 'Mon';

-- Add trainingDays to Profile
ALTER TABLE "Profile" ADD COLUMN "trainingDays" TEXT[] NOT NULL DEFAULT '{}';

-- Backfill trainingDays from trainingDaysPerWeek for existing profiles
UPDATE "Profile" SET "trainingDays" = CASE "trainingDaysPerWeek"
  WHEN 1 THEN ARRAY['Mon']
  WHEN 2 THEN ARRAY['Mon','Thu']
  WHEN 3 THEN ARRAY['Mon','Wed','Fri']
  WHEN 4 THEN ARRAY['Mon','Tue','Thu','Fri']
  WHEN 5 THEN ARRAY['Mon','Tue','Wed','Thu','Fri']
  WHEN 6 THEN ARRAY['Mon','Tue','Wed','Thu','Fri','Sat']
  WHEN 7 THEN ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  ELSE ARRAY[]::TEXT[]
END WHERE cardinality("trainingDays") = 0;
