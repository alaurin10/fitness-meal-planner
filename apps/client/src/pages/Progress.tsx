import { useMemo, useState } from "react";
import { rotateDays, dayIdxFromDate, startOfWeek as sharedStartOfWeek } from "@platform/shared";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Heatmap } from "../components/Heatmap";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { WeeklyBars } from "../components/WeeklyBars";
import { Chip, PhoneHeader, Sparkline } from "../components/Primitives";
import { useLogProgress, useProgress } from "../hooks/useProgress";
import { useStreaks } from "../hooks/useStreaks";
import { useHistory } from "../hooks/useHistory";
import { useSettings } from "../hooks/useSettings";
import { useWeekStartDay } from "../hooks/useWeekStartDay";
import { formatWeight, kgToPounds, weightUnitLabel } from "../lib/units";

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
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 83);
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
    let hydrationHits = 0, hydrationDays = 0;

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
      hydrationDays++;
      if (rec.hydration.done) hydrationHits++;
    }

    return {
      workoutsDone,
      workoutsTotal,
      totalSets,
      avgCalories: calDays > 0 ? Math.round(totalCal / calDays) : 0,
      avgProtein: calDays > 0 ? Math.round(totalProtein / calDays) : 0,
      hydrationRate: hydrationDays > 0 ? Math.round((hydrationHits / hydrationDays) * 100) : 0,
    };
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

  const { series, latest, delta } = useMemo(() => {
    const sorted = [...(logs ?? [])].sort(
      (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
    );
    const ws = sorted
      .filter((l) => l.weightLbs != null)
      .map((l) => formatWeight(l.weightLbs as number, unitSystem));
    const last = ws.length ? ws[ws.length - 1] : null;
    const first = ws.length ? ws[0] : null;
    const d = last != null && first != null ? last - first : null;
    return { series: ws, latest: last, delta: d };
  }, [logs, unitSystem]);

  return (
    <Layout>
      <PhoneHeader
        title="Progress"
        subtitle={
          latest != null
            ? delta != null && delta !== 0
              ? `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta).toFixed(1)} ${unitLabel} over ${series.length} entries`
              : "Keep logging to see your trend."
            : "Log your first weight to start a trend line."
        }
      />

      {/* Chart */}
      <div className="px-4 pt-1">
        <Card>
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="eyebrow">Weight · recent</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  marginTop: 6,
                }}
              >
                <span
                  className="font-display"
                  style={{ fontSize: 32, color: "var(--ink)", lineHeight: 1 }}
                >
                  {latest != null ? latest.toFixed(1) : "—"}
                </span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{unitLabel}</span>
                {delta != null && delta !== 0 && (
                  <Chip
                    variant={delta < 0 ? "moss" : "honey"}
                    style={{ marginLeft: 6 }}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)}
                  </Chip>
                )}
              </div>
            </div>
          </div>
          {series.length > 1 ? (
            <Sparkline
              data={series.slice(-14)}
              width={340}
              height={80}
              color="var(--accent)"
            />
          ) : (
            <div
              style={{
                padding: "18px 0",
                textAlign: "center",
                color: "var(--muted)",
                fontSize: 12,
              }}
            >
              Two or more entries draws a line.
            </div>
          )}
        </Card>
      </div>

      {/* Log entry */}
      <div className="px-4 pt-4">
        <Card>
          <div className="eyebrow mb-3">Log today</div>
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
          >
            <div className="flex gap-2.5 mb-2.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Weight"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="field-input"
                  style={{ paddingRight: 36 }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  {unitLabel}
                </span>
              </div>
              <Button
                type="submit"
                variant="accent"
                disabled={!weight || log.isPending}
              >
                {log.isPending ? "…" : "Log"}
              </Button>
            </div>
            <input
              type="text"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="field-input"
            />
            {toast && (
              <div
                className="fade-up"
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "var(--moss)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon name="check" size={14} /> Saved. Nice work.
              </div>
            )}
          </form>
        </Card>
      </div>

      {/* Recent */}
      {isLoading && (
        <div className="px-4 pt-4">
          <Card>Loading history…</Card>
        </div>
      )}
      {logs && logs.length > 0 && (
        <>
          <div className="px-6 pt-4 pb-2">
            <div className="eyebrow">Recent entries</div>
          </div>
          <div className="px-4">
            <Card flush>
              {logs.map((l, i) => (
                <div
                  key={l.id}
                  style={{
                    padding: "14px 18px",
                    borderBottom:
                      i < logs.length - 1 ? "1px solid var(--hair)" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--ink)",
                        fontWeight: 500,
                      }}
                    >
                      {new Date(l.loggedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    {l.note && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--muted)",
                          marginTop: 3,
                        }}
                      >
                        {l.note}
                      </div>
                    )}
                  </div>
                  {l.weightLbs != null && (
                    <div
                      className="font-display"
                      style={{ fontSize: 17, color: "var(--sumi)" }}
                    >
                      {formatWeight(l.weightLbs, unitSystem)}
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--muted)",
                          marginLeft: 2,
                        }}
                      >
                        {unitLabel}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </div>
        </>
      )}

      {/* ── Streaks ──────────────────────────────────────────────────── */}
      {streaksQuery.data && (
        <div className="px-4 pt-6">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Streaks</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <StreakCard label="Workout" current={streaksQuery.data.workout.current} best={streaksQuery.data.workout.best} color="var(--moss)" />
            <StreakCard label="Meals" current={streaksQuery.data.meals.current} best={streaksQuery.data.meals.best} color="var(--honey)" />
            <StreakCard label="Hydration" current={streaksQuery.data.hydration.current} best={streaksQuery.data.hydration.best} color="var(--accent)" />
            <StreakCard label="Overall" current={streaksQuery.data.overall.current} best={streaksQuery.data.overall.best} color="var(--accent)" highlight />
          </div>
        </div>
      )}

      {/* ── This Week ────────────────────────────────────────────────── */}
      {weekStats && weekDays && (
        <div className="px-4 pt-6">
          <div className="eyebrow" style={{ marginBottom: 10 }}>This week</div>
          <Card>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16, fontSize: 12.5, color: "var(--sumi)" }}>
              <span><b style={{ color: "var(--ink)", fontWeight: 600 }}>{weekStats.workoutsDone}</b> / {weekStats.workoutsTotal} workouts</span>
              <span><b style={{ color: "var(--ink)", fontWeight: 600 }}>{weekStats.totalSets}</b> sets</span>
              <span>Avg <b style={{ color: "var(--ink)", fontWeight: 600 }}>{weekStats.avgCalories}</b> kcal</span>
              <span>Avg <b style={{ color: "var(--ink)", fontWeight: 600 }}>{weekStats.avgProtein}</b>g protein</span>
              <span><b style={{ color: "var(--ink)", fontWeight: 600 }}>{weekStats.hydrationRate}%</b> hydration</span>
            </div>
            <WeeklyBars days={weekDays} height={100} />
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

      {/* ── History Heatmap ──────────────────────────────────────────── */}
      {heatmapData.length > 0 && (
        <div className="px-4 pt-6 pb-4">
          <div className="eyebrow" style={{ marginBottom: 10 }}>12-week history</div>
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
    </Layout>
  );
}

function StreakCard({
  label,
  current,
  best,
  color,
  highlight,
}: {
  label: string;
  current: number;
  best: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="streak-card"
      style={highlight ? { borderColor: color, background: `color-mix(in srgb, ${color} 5%, var(--paper))` } : undefined}
    >
      <Icon name="flame" size={16} style={{ color }} />
      <div className="font-display" style={{ fontSize: 28, color: "var(--ink)", lineHeight: 1, marginTop: 2 }}>
        {current}
      </div>
      <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {current === 1 ? "day" : "days"}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink)", marginTop: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 9.5, color: "var(--muted)" }}>Best: {best}</div>
    </div>
  );
}

function dayKeyStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
