-- CreateTable
CREATE TABLE "UserExerciseBaseline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "loadLbs" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserExerciseBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserExerciseBaseline_userId_normalizedKey_key" ON "UserExerciseBaseline"("userId", "normalizedKey");

-- CreateIndex
CREATE INDEX "UserExerciseBaseline_userId_idx" ON "UserExerciseBaseline"("userId");

-- AddForeignKey
ALTER TABLE "UserExerciseBaseline" ADD CONSTRAINT "UserExerciseBaseline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing ProgressLog.liftPRs entries. For each (user, exercise)
-- pair, take the most recently logged weight. The normalizedKey mirrors the
-- JS normalizeExerciseName helper: lowercase, trimmed, qualifier words removed,
-- whitespace collapsed.
INSERT INTO "UserExerciseBaseline" ("id", "userId", "exerciseName", "normalizedKey", "loadLbs", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text AS id,
    ranked."userId",
    ranked."exerciseName",
    ranked."normalizedKey",
    ranked."loadLbs",
    NOW() AS "createdAt",
    NOW() AS "updatedAt"
FROM (
    SELECT
        pl."userId",
        kv.key AS "exerciseName",
        trim(regexp_replace(
            regexp_replace(
                lower(kv.key),
                '\b(barbell|dumbbell|db|bb|cable|machine|smith|kettlebell|kb|bodyweight|bw)\b',
                ' ',
                'g'
            ),
            '\s+',
            ' ',
            'g'
        )) AS "normalizedKey",
        (kv.value)::text::double precision AS "loadLbs",
        ROW_NUMBER() OVER (
            PARTITION BY pl."userId", trim(regexp_replace(
                regexp_replace(
                    lower(kv.key),
                    '\b(barbell|dumbbell|db|bb|cable|machine|smith|kettlebell|kb|bodyweight|bw)\b',
                    ' ',
                    'g'
                ),
                '\s+',
                ' ',
                'g'
            ))
            ORDER BY pl."loggedAt" DESC
        ) AS rn
    FROM "ProgressLog" pl,
         LATERAL jsonb_each(COALESCE(pl."liftPRs", '{}'::jsonb)) AS kv
    WHERE pl."liftPRs" IS NOT NULL
      AND jsonb_typeof(pl."liftPRs") = 'object'
      AND jsonb_typeof(kv.value) = 'number'
) ranked
WHERE ranked.rn = 1
  AND ranked."normalizedKey" <> ''
ON CONFLICT ("userId", "normalizedKey") DO NOTHING;
