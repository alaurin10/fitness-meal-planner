import type { Meal } from "../lib/types";

/**
 * Compact per-day macro rollup shown on the Meals page so the user can see at a
 * glance whether a day's meals actually hit their calorie/protein goals — the
 * client-side counterpart to the server's macro verification.
 */
export function DayMacroSummary({
  meals,
  calorieTarget,
  proteinTarget,
}: {
  meals: Meal[];
  calorieTarget?: number;
  proteinTarget?: number | null;
}) {
  if (meals.length === 0) return null;

  const totals = meals.reduce(
    (acc, m) => {
      acc.calories += m.calories ?? 0;
      acc.proteinG += m.proteinG ?? 0;
      acc.carbsG += m.carbsG ?? 0;
      acc.fatG += m.fatG ?? 0;
      return acc;
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid var(--hair)",
      }}
    >
      <MacroStat
        label="kcal"
        value={totals.calories}
        target={calorieTarget}
        tone={calorieTone(totals.calories, calorieTarget)}
      />
      <MacroStat
        label="protein"
        value={totals.proteinG}
        target={proteinTarget ?? undefined}
        suffix="g"
        tone={proteinTone(totals.proteinG, proteinTarget ?? undefined)}
      />
      {totals.carbsG > 0 && <MacroStat label="carbs" value={totals.carbsG} suffix="g" tone="neutral" />}
      {totals.fatG > 0 && <MacroStat label="fat" value={totals.fatG} suffix="g" tone="neutral" />}
    </div>
  );
}

type Tone = "good" | "under" | "over" | "neutral";

function MacroStat({
  label,
  value,
  target,
  suffix = "",
  tone,
}: {
  label: string;
  value: number;
  target?: number;
  suffix?: string;
  tone: Tone;
}) {
  const color =
    tone === "good"
      ? "var(--moss)"
      : tone === "under"
        ? "var(--honey)"
        : tone === "over"
          ? "var(--rose)"
          : "var(--muted)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 5,
        fontSize: 12.5,
        padding: "3px 9px",
        borderRadius: 999,
        background: "color-mix(in srgb, var(--muted) 8%, transparent)",
      }}
    >
      <span className="font-display" style={{ color, fontSize: 14 }}>
        {Math.round(value)}
        {suffix}
      </span>
      {target ? (
        <span style={{ color: "var(--muted)" }}>
          / {Math.round(target)}
          {suffix} {label}
        </span>
      ) : (
        <span style={{ color: "var(--muted)" }}>{label}</span>
      )}
    </div>
  );
}

// ±12% of the calorie target reads as "on target".
function calorieTone(value: number, target?: number): Tone {
  if (!target) return "neutral";
  const offPct = ((value - target) / target) * 100;
  if (offPct < -12) return "under";
  if (offPct > 12) return "over";
  return "good";
}

// Protein: meeting or exceeding the target is good; only short reads as under.
function proteinTone(value: number, target?: number): Tone {
  if (!target) return "neutral";
  if (value >= target * 0.9) return "good";
  return "under";
}
