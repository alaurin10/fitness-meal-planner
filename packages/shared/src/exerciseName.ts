/**
 * Normalize an exercise name for cross-plan matching. Two names that refer to
 * the same lift (e.g. "Bench Press" and "Barbell Bench Press") should produce
 * the same normalized key so a user-set baseline survives LLM renames.
 *
 * Must stay in sync with the SQL backfill in
 * packages/db/prisma/migrations/.../add_user_exercise_baseline/migration.sql.
 */
const QUALIFIERS = [
  "barbell",
  "dumbbell",
  "db",
  "bb",
  "cable",
  "machine",
  "smith",
  "kettlebell",
  "kb",
  "bodyweight",
  "bw",
];

const QUALIFIER_RE = new RegExp(`\\b(?:${QUALIFIERS.join("|")})\\b`, "g");

export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(QUALIFIER_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}
