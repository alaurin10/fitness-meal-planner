import { useMemo, useState } from "react";
import { rotateDays, dayIdxFromDate, startOfWeek as sharedStartOfWeek } from "@platform/shared";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Heatmap } from "../components/Heatmap";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { WeeklyBars } from "../components/WeeklyBars";
import { SkeletonList } from "../components/Skeleton";
import { AnimatedNumber, Chip, PageHero, TimeSparkline } from "../components/Primitives";
import type { TimeDatum } from "../components/Primitives";
import { useLogProgress, useProgress } from "../hooks/useProgress";
import { useStreaks } from "../hooks/useStreaks";
import { useHistory } from "../hooks/useHistory";
import { useSettings } from "../hooks/useSettings";
import { useWeekStartDay } from "../hooks/useWeekStartDay";
import { formatLoad, formatWeight, kgToPounds, weightUnitLabel } from "../lib/units";

const VOLUME_SERIES_DAYS = 14;

export function ProgressPage() {
  const { data: logs, isLoading } = useProgress();
  const settingsQuery = useSettings();
  const log = useLogProgress();
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState(false);
  const unitSystem = settingsQuery.data?.unitSystem ?? "imperial";
  const unitLabel = weightUnitLabel(unitSystem);
  const weekStartDay = useWeekStartDay();

  // Analytics data
  const streaksQuery = useStreaks();
  const today = new Date();
  const todayKey = dayKeyStr(today);
  const twelveWeeksAgo = new Date(today);
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 182);
  const historyFrom = dayKeyStr(twelveWeeksAgo);
  const historyQuery = useHistory(historyFrom, todayKey);

  // Compute week start based on user setting
  const weekStart = sharedStartOfWeek(today, weekStartDay);

  const weekDays = useMemo(() => {
    if (!historyQuery.data) return null;
    const rotated = rotateDays(weekStartDay);
    const LABELS = rotated.map((d) => d[0]!);
    const todayIdx = dayIdxFromDate(today, weekStartDay);
    return LABELS.map((label, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dk = dayKeyStr(d);
      const rec = historyQuery.data.days[dk];
      const isFuture = i > todayIdx;
      return {
        label,
        isToday: i === todayIdx,
        isFuture,
        values: [
          {
            color: "var(--moss)",
            fraction: rec ? (rec.workout.total > 0 ? rec.workout.completed / rec.workout.total : 0) : 0,
          },
          {
            color: "var(--accent)",
            fraction: rec ? (rec.meals.total > 0 ? rec.meals.completed / rec.meals.total : 0) : 0,
          },
          {
            color: "var(--honey)",
            fraction: rec ? (rec.hydration.goal > 0 ? Math.min(rec.hydration.cups / rec.hydration.goal, 1) : 0) : 0,
          },
        ],
      };
    });
  }, [historyQuery.data]);

  // Compute weekly summary stats
  const weekStats = useMemo(() => {
    if (!historyQuery.data) return null;
    const todayIdx = dayIdxFromDate(today, weekStartDay);
    let workoutsDone = 0, workoutsTotal = 0, totalSets = 0;
    let totalCal = 0, totalProtein = 0, calDays = 0;
    let hydrationFractionSum = 0, hydrationDays = 0;
    let totalSteps = 0, stepDays = 0, totalActiveKcal = 0, activeKcalDays = 0;

    for (let i = 0; i <= todayIdx; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dk = dayKeyStr(d);
      const rec = historyQuery.data.days[dk];
      if (!rec) continue;

      if (rec.workout.total > 0) {
        workoutsTotal++;
        if (rec.workout.done) workoutsDone++;
        totalSets += rec.workout.completed;
      }
      if (rec.meals.total > 0) {
        totalCal += rec.meals.calories;
        totalProtein += rec.meals.protein;
        calDays++;
      }
      if (rec.hydration.goal > 0) {
        hydrationDays++;
        hydrationFractionSum += Math.min(rec.hydration.cups / rec.hydration.goal, 1);
      }
      if (rec.garmin?.steps != null) {
        totalSteps += rec.garmin.steps;
        stepDays++;
      }
      if (rec.garmin?.activeKilocalories != null) {
        totalActiveKcal += rec.garmin.activeKilocalories;
        activeKcalDays++;
      }
    }

    return {
      workoutsDone,
      workoutsTotal,
      totalSets,
      avgCalories: calDays > 0 ? Math.round(totalCal / calDays) : 0,
      avgProtein: calDays > 0 ? Math.round(totalProtein / calDays) : 0,
      hydrationRate: hydrationDays > 0 ? Math.round((hydrationFractionSum / hydrationDays) * 100) : 0,
      // Garmin-only stats; zero days means no connection (tiles hidden).
      avgSteps: stepDays > 0 ? Math.round(totalSteps / stepDays) : null,
      avgActiveKcal: activeKcalDays > 0 ? Math.round(totalActiveKcal / activeKcalDays) : null,
    };
  }, [historyQuery.data]);

  const loadStats = useMemo(() => {
    if (!historyQuery.data) return null;
    const days = historyQuery.data.days;
    const todayIdx = dayIdxFromDate(today, weekStartDay);

    const sumVolume = (start: Date, dayCount: number) => {
      let total = 0;
      for (let i = 0; i < dayCount; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        total += days[dayKeyStr(d)]?.workout.volumeLbs ?? 0;
      }
      return total;
    };

    const weekTotal = sumVolume(weekStart, todayIdx + 1);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekTotal = sumVolume(lastWeekStart, 7);

    const seriesStart = new Date(today);
    seriesStart.setDate(seriesStart.getDate() - (VOLUME_SERIES_DAYS - 1));
    const series: TimeDatum[] = [];
    for (let i = 0; i < VOLUME_SERIES_DAYS; i++) {
      const d = new Date(seriesStart);
      d.setDate(d.getDate() + i);
      series.push({ date: new Date(d), value: days[dayKeyStr(d)]?.workout.volumeLbs ?? 0 });
    }

    const deltaPct = lastWeekTotal > 0
      ? Math.round(((weekTotal - lastWeekTotal) / lastWeekTotal) * 100)
      : null;

    return { weekTotal, lastWeekTotal, deltaPct, series };
  }, [historyQuery.data]);

  // Heatmap data
  const heatmapData = useMemo(() => {
    if (!historyQuery.data) return [];
    return Object.entries(historyQuery.data.days).map(([date, rec]) => {
      let score = 0;
      if (rec.workout.done || rec.workout.total === 0) score++;
      if (rec.meals.done) score++;
      if (rec.hydration.done) score++;
      const level = score === 0 ? 0 : score === 1 ? 1 : score === 2 ? 2 : 3;
      return { date, level: level as 0 | 1 | 2 | 3 };
    });
  }, [historyQuery.data]);

  const { series: weightSeries, latest, delta } = useMemo(() => {
    const sorted = [...(logs ?? [])].sort(
      (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
    );
    const ws: TimeDatum[] = sorted
      .filter((l) => l.weightLbs != null)
      .map((l) => ({ date: new Date(l.loggedAt), value: formatWeight(l.weightLbs as number, unitSystem) }));
    const last = ws.length ? ws[ws.length - 1]!.value : null;
    const first = ws.length ? ws[0]!.value : null;
    const d = last != null && first != null ? last - first : null;
    return { series: ws, latest: last, delta: d };
  }, [logs, unitSystem]);

  return (
    <Layout>
      <PageHero
        title="Progress"
        subtitle={
          latest != null
            ? delta != null && delta !== 0
              ? `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta).toFixed(1)} ${unitLabel} over ${weightSeries.length} entries`
              : "Keep logging to see your trend."
            : "Log your first weight to start a trend line."
        }
      />

      {/* ── Streaks: overall as the statement, categories as cells ───── */}
      {streaksQuery.data && (
        <div className="px-4 pt-1 fade-up">
          <Card tone="accent" className="texture-grain">
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "center",
                    gap: 4,
                    color: "var(--on-accent)",
                  }}
                >
                  <Icon name="flame" size={28} style={{ alignSelf: "center" }} />
                  <span className="display-stat" style={{ fontSize: 46 }}>
                    <AnimatedNumber value={streaksQuery.data.overall.current} />
                  </span>
                </div>
                <div className="eyebrow" style={{ marginTop: 4 }}>
                  day streak
                </div>
                <div className="text-caption" style={{ marginTop: 2 }}>
                  Best: {streaksQuery.data.overall.best}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                }}
              >
                <StreakCell label="Workout" current={streaksQuery.data.workout.current} best={streaksQuery.data.workout.best} color="var(--moss)" />
                <StreakCell label="Meals" current={streaksQuery.data.meals.current} best={streaksQuery.data.meals.best} color="var(--honey)" />
                <StreakCell label="Water" current={streaksQuery.data.hydration.current} best={streaksQuery.data.hydration.best} color="var(--accent)" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── This Week ────────────────────────────────────────────────── */}
      {weekStats && weekDays && (
        <div className="px-4 pt-4">
          <div className="section-title" style={{ marginBottom: 10 }}>This week</div>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              <StatCell label="Workouts" value={`${weekStats.workoutsDone}/${weekStats.workoutsTotal}`} color="var(--moss)" />
              <StatCell label="Avg kcal" value={weekStats.avgCalories.toLocaleString()} color="var(--accent)" />
              <StatCell label="Avg protein" value={`${weekStats.avgProtein}g`} color="var(--honey)" />
              <StatCell label="Sets" value={weekStats.totalSets.toString()} color="var(--moss)" />
              <StatCell label="Hydration" value={`${weekStats.hydrationRate}%`} color="var(--accent)" />
              {weekStats.avgSteps != null && (
                <StatCell label="Avg steps" value={weekStats.avgSteps.toLocaleString()} color="var(--honey)" />
              )}
              {weekStats.avgActiveKcal != null && (
                <StatCell label="Avg burn" value={`${weekStats.avgActiveKcal.toLocaleString()} kcal`} color="var(--accent)" />
              )}
            </div>
            <WeeklyBars days={weekDays} height={132} />
            <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 10, color: "var(--muted)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--moss)" }} /> Workout
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--accent)" }} /> Meals
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--honey)" }} /> Hydration
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* ── Training load ────────────────────────────────────────────── */}
      {loadStats && (
        <div className="px-4 pt-4">
          <div className="section-title" style={{ marginBottom: 10 }}>Training load</div>
          <Card>
            <div className="flex items-end justify-between mb-2">
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span className="display-stat" style={{ fontSize: 34 }}>
                  {formatLoad(loadStats.weekTotal, unitSystem).toLocaleString()}
                </span>
                <span className="text-caption">{unitLabel}</span>
                {loadStats.deltaPct != null && loadStats.deltaPct !== 0 && (
                  <Chip
                    variant={loadStats.deltaPct > 0 ? "moss" : "honey"}
                    style={{ marginLeft: 4 }}
                  >
                    {loadStats.deltaPct > 0 ? "+" : ""}
                    {loadStats.deltaPct}% vs last week
                  </Chip>
                )}
              </div>
              <Icon name="dumbbell" size={18} style={{ color: "var(--moss)" }} />
            </div>
            {loadStats.series.some((d) => d.value > 0) ? (
              <TimeSparkline
                data={loadStats.series.filter((d) => d.value > 0)}
                width={340}
                height={90}
                color="var(--moss)"
                formatValue={(v) => formatLoad(v, unitSystem).toLocaleString()}
              />
            ) : (
              <div
                style={{
                  padding: "12px 0",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: 12,
                }}
              >
                Complete a set to start tracking volume.
              </div>
            )}
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>
              Sum of weight × reps × completed sets this week. Bodyweight exercises count at half your profile weight.
            </div>
          </Card>
        </div>
      )}

      {/* ── 12-week History Heatmap ──────────────────────────────────── */}
      {heatmapData.length > 0 && (
        <div className="px-4 pt-4">
          <div className="section-title" style={{ marginBottom: 10 }}>Activity history</div>
          <Card>
            <Heatmap data={heatmapData} weeks={12} color="var(--moss)" weekStartDay={weekStartDay} />
            <div style={{ display: "flex", gap: 4, marginTop: 10, alignItems: "center", fontSize: 10, color: "var(--muted)" }}>
              <span>Less</span>
              {[0, 1, 2, 3].map((level) => (
                <span
                  key={level}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    background:
                      level === 0
                        ? "color-mix(in srgb, var(--muted) 10%, transparent)"
                        : level === 1
                          ? "color-mix(in srgb, var(--moss) 25%, transparent)"
                          : level === 2
                            ? "color-mix(in srgb, var(--moss) 55%, transparent)"
                            : "var(--moss)",
                  }}
                />
              ))}
              <span>More</span>
            </div>
          </Card>
        </div>
      )}

      {/* ── Weight ───────────────────────────────────────────────────── */}
      <div className="px-4 pt-4">
        <div className="section-title" style={{ marginBottom: 10 }}>Weight</div>
        <Card>
          <div className="flex items-end justify-between mb-2">
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="display-stat" style={{ fontSize: 34 }}>
                {latest != null ? latest.toFixed(1) : "—"}
              </span>
              <span className="text-caption">{unitLabel}</span>
              {delta != null && delta !== 0 && (
                <Chip
                  variant={delta < 0 ? "moss" : "honey"}
                  style={{ marginLeft: 4 }}
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)}
                </Chip>
              )}
            </div>
          </div>
          {weightSeries.length > 1 ? (
            <TimeSparkline
              data={weightSeries.slice(-30)}
              width={340}
              height={90}
              color="var(--accent)"
              formatValue={(v) => v.toFixed(1)}
            />
          ) : (
            <div
              style={{
                padding: "12px 0",
                textAlign: "center",
                color: "var(--muted)",
                fontSize: 12,
              }}
            >
              Two or more entries draws a line.
            </div>
          )}

          {/* Inline log form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              log.mutate(
                {
                  weightLbs: weight
                    ? unitSystem === "metric"
                      ? kgToPounds(Number(weight))
                      : Number(weight)
                    : null,
                  note: note || undefined,
                },
                {
                  onSuccess: () => {
                    setWeight("");
                    setNote("");
                    setToast(true);
                    setTimeout(() => setToast(false), 1800);
                  },
                },
              );
            }}
            style={{ borderTop: "1px solid var(--hair)", marginTop: 12, paddingTop: 12 }}
          >
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Weight"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="field-input"
                  style={{ paddingRight: 36, height: 44, fontSize: 16 }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 11,
                    color: "var(--muted)",
                  }}
                >
                  {unitLabel}
                </span>
              </div>
              <input
                type="text"
                placeholder="Note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="field-input"
                style={{ flex: 1, height: 44, fontSize: 16 }}
              />
              <Button
                type="submit"
                variant="accent"
                disabled={!weight || log.isPending}
                style={{ height: 44, minWidth: 0, paddingInline: 14 }}
              >
                {log.isPending ? "…" : "Log"}
              </Button>
            </div>
            {toast && (
              <div
                className="fade-up"
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "var(--moss)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon name="check" size={14} /> Saved
              </div>
            )}
          </form>
        </Card>
      </div>

      {/* ── Recent entries ───────────────────────────────────────────── */}
      {isLoading && (
        <div className="px-4 pt-4">
          <SkeletonList count={3} lines={2} />
        </div>
      )}
      {logs && logs.length > 0 && (
        <div className="px-4 pt-4 pb-4">
          <div className="section-title" style={{ marginBottom: 10 }}>Recent entries</div>
          <Card flush className="stagger-in">
            {logs.slice(0, 5).map((l, i, arr) => {
              // A log is either a body-weight entry (weightLbs) or an exercise
              // load update (liftPRs: { [exerciseName]: lbs }). Render both.
              const lifts = l.liftPRs ? Object.entries(l.liftPRs) : [];
              const isLift = l.weightLbs == null && lifts.length > 0;
              const subLabel = isLift
                ? lifts.map(([name]) => name).join(", ")
                : l.note;
              const rightWeight =
                l.weightLbs != null
                  ? l.weightLbs
                  : lifts.length === 1
                    ? lifts[0]![1]
                    : null;
              return (
                <div
                  key={l.id}
                  className="popmenu-item"
                  style={{
                    padding: "10px 16px",
                    borderBottom:
                      i < arr.length - 1 ? "1px solid var(--hair)" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    transition: "background 150ms ease",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--ink)",
                        fontWeight: 500,
                      }}
                    >
                      {new Date(l.loggedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    {subLabel && (
                      <div className="text-caption" style={{ fontSize: 11, marginTop: 2 }}>
                        {subLabel}
                      </div>
                    )}
                  </div>
                  {rightWeight != null && (
                    <div
                      className="font-display"
                      style={{ fontSize: 15, color: "var(--sumi)" }}
                    >
                      {formatWeight(rightWeight, unitSystem)}
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--muted)",
                          marginLeft: 2,
                        }}
                      >
                        {unitLabel}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </div>
      )}
    </Layout>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: "var(--radius-sm)",
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        textAlign: "center",
      }}
    >
      <div className="font-display" style={{ fontSize: 18, color: "var(--ink)", lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

// Frosted cells that sit on the accent streak band.
function StreakCell({
  label,
  current,
  best,
}: {
  label: string;
  current: number;
  best: number;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "12px 6px",
        borderRadius: "var(--radius-sm)",
        background: "color-mix(in srgb, var(--on-accent) 14%, transparent)",
        textAlign: "center",
      }}
    >
      <div className="font-display" style={{ fontSize: 24, color: "var(--on-accent)", lineHeight: 1 }}>
        {current}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--on-accent)", marginTop: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 9.5, color: "color-mix(in srgb, var(--on-accent) 70%, transparent)" }}>
        Best: {best}
      </div>
    </div>
  );
}

function dayKeyStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
