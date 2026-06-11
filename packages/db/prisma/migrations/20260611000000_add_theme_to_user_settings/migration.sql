-- Add theme preference to user settings ("light" | "dark" | "system")
ALTER TABLE "UserSettings" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'system';
