import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { GeneratingProgress } from "../components/GeneratingProgress";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { PhoneHeader } from "../components/Primitives";
import { WorkoutMode } from "../components/WorkoutMode";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { localDayKey } from "../hooks/useMealCompletions";
import { useSettings } from "../hooks/useSettings";
import {
  useCurrentWorkoutPlan,
  useGenerateWorkoutPlan,
  useUpdateExerciseLoad,
  type TrainingDay,
} from "../hooks/useWorkoutPlan";
import { useWorkoutCompletions } from "../hooks/useWorkoutCompletions";
import {
  useWorkoutSession,
  sessionProgress,
} from "../hooks/useWorkoutSession";
import { ProgressRing } from "../components/ProgressRing";
import {
  formatLoad,
  kgToPounds,
  poundsToKg,
  roundTo,
  weightUnitLabel,
  type UnitSystem,
} from "../lib/units";

const DAYS: TrainingDay["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WorkoutsPage() {
  const { data: plan, isLoading } = useCurrentWorkoutPlan();
  const settingsQuery = useSettings();
  const generate = useGenerateWorkoutPlan();
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [activeDay, setActiveDay] = useState<TrainingDay["day"]>(
    DAYS[todayIdx] ?? "Mon",
  );
  const [workoutInProgress, setWorkoutInProgress] = useState(false);
  const completion = useWorkoutCompletions(plan?.id, localDayKey());
  const workoutSession = useWorkoutSession(plan?.id, localDayKey());
  const updateLoad = useUpdateExerciseLoad();
  const [editingLoadIdx, setEditingLoadIdx] = useState<number | null>(null);
  const isDesktop = useIsDesktop();
  const unitSystem = settingsQuery.data?.unitSystem ?? "imperial";
  const unitLabel = weightUnitLabel(unitSystem);

  if (isLoading) {
    return (
      <Layout>
        <div className="px-4 py-4">
          <Card>Loading…</Card>
        </div>
      </Layout>
    );
  }

  const headerRight = (
    <Link to="/progress" aria-label="Progress" className="tappable">
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          border: "1px solid var(--hair)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--sumi)",
        }}
      >
        <Icon name="progress" size={18} />
      </span>
    </Link>
  );

  if (!plan) {
    return (
      <Layout>
        <PhoneHeader
          title="Workouts"
          subtitle="No plan yet. Generate one shaped by your profile."
          right={headerRight}
        />
        <div className="px-4 pt-2">
          {generate.isPending ? (
            <GeneratingProgress kind="workout" estimatedSeconds={45} />
          ) : (
            <Card tone="gradient">
              <div className="eyebrow">This week</div>
              <div
                className="font-display mt-1"
                style={{ fontSize: 24, color: "var(--ink)", letterSpacing: "-0.01em" }}
              >
                No active plan
              </div>
              <Button
                className="w-full mt-5"
                onClick={() => generate.mutate()}
              >
                <Icon name="sparkle" size={16} />
                Generate plan
              </Button>
              {generate.isError && (
                <p style={{ color: "var(--rose)", fontSize: 12.5, marginTop: 12 }}>
                  {(generate.error as Error).message}
                </p>
              )}
            </Card>
          )}
        </div>
      </Layout>
    );
  }

  const dayEntry = plan.planJson.days.find((d) => d.day === activeDay);
  const exercises = dayEntry?.exercises ?? [];
  const viewingToday = activeDay === DAYS[todayIdx];

  const sessProgress = sessionProgress(workoutSession.session, exercises);

  if (workoutInProgress && exercises.length > 0) {
    return (
      <WorkoutMode
        exercises={exercises}
        dayLabel={longDay(activeDay)}
        unitSystem={unitSystem}
        initialExerciseIdx={workoutSession.session?.exerciseIdx}
        initialSetNum={workoutSession.session?.setNum}
        onProgress={workoutSession.saveSession}
        onSessionClear={workoutSession.clearSession}
        onExit={() => setWorkoutInProgress(false)}
        onComplete={
          // Only auto-mark complete when the user is doing today's session.
          // Browsing a future/past day is just preview.
          viewingToday && !completion.isComplete
            ? completion.markComplete
            : undefined
        }
      />
    );
  }

  return (
    <Layout>
      <PhoneHeader
        title="Workouts"
        subtitle={plan.planJson.summary}
        right={headerRight}
      />

      <div style={isDesktop ? { display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, padding: "0 16px" } : undefined}>
      <div style={isDesktop ? { paddingTop: 4 } : { padding: "4px 16px 8px", overflowX: "auto" as const }}>
        <div style={{ display: "flex", flexDirection: isDesktop ? "column" as const : "row" as const, gap: 6 }}>
          {DAYS.map((d) => {
            const day = plan.planJson.days.find((pd) => pd.day === d);
            const count = day?.exercises.length ?? 0;
            const isActive = activeDay === d;
            const isToday = d === DAYS[todayIdx];
            return (
              <button
                key={d}
                onClick={() => setActiveDay(d)}
                className="tappable"
                style={{
                  flex: isDesktop ? "none" : 1,
                  minWidth: isDesktop ? undefined : 56,
                  border: "none",
                  background: isActive ? "var(--ink)" : "var(--paper)",
                  color: isActive ? "var(--paper)" : "var(--ink)",
                  padding: "10px 8px",
                  borderRadius: "calc(var(--radius) * 0.7)",
                  fontFamily: "var(--font-body)",
                  fontSize: 12.5,
                  fontWeight: 500,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  position: "relative",
                }}
              >
                <span
                  style={{
                    fontSize: 9.5,
                    opacity: 0.7,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {d}
                </span>
                <span className="font-display" style={{ fontSize: 16 }}>
                  {count === 0 ? "·" : count}
                </span>
                {isToday && !isActive && (
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 6,
                      width: 6,
                      height: 6,
                      borderRadius: 99,
                      background: "var(--accent)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
      <div className="px-4 pt-2">
        <Card>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="eyebrow">{longDay(activeDay)}</div>
              <div
                className="font-display mt-1"
                style={{ fontSize: 24, color: "var(--ink)", letterSpacing: "-0.01em" }}
              >
                {dayEntry?.focus ?? "Rest"}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>
                {exercises.length
                  ? `${exercises.length} lifts planned.`
                  : "A calm day — recover well."}
              </div>
            </div>
            {viewingToday && sessProgress.completed > 0 && !completion.isComplete ? (
              <ProgressRing
                value={sessProgress.fraction}
                size={44}
                strokeWidth={4}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--accent)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {sessProgress.completed}/{sessProgress.total}
                </span>
              </ProgressRing>
            ) : completion.isComplete && viewingToday ? (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  color: "var(--paper)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="check" size={22} stroke={2.5} />
              </div>
            ) : (
              <Icon
                name="dumbbell"
                size={38}
                style={{ color: "var(--accent)", flexShrink: 0 }}
              />
            )}
          </div>
        </Card>
      </div>

      {exercises.length > 0 && (
        <div className="px-4 pt-3">
          <Card flush>
            {exercises.map((ex, i) => (
              <div
                key={i}
                style={{
                  padding: "16px 18px",
                  borderBottom:
                    i < exercises.length - 1 ? "1px solid var(--hair)" : "none",
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  opacity:
                    viewingToday &&
                    workoutSession.session &&
                    !completion.isComplete &&
                    i < workoutSession.session.exerciseIdx
                      ? 0.45
                      : 1,
                  transition: "opacity 300ms ease",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background:
                      viewingToday &&
                      workoutSession.session &&
                      !completion.isComplete &&
                      i < workoutSession.session.exerciseIdx
                        ? "var(--accent)"
                        : "var(--clay)",
                    color:
                      viewingToday &&
                      workoutSession.session &&
                      !completion.isComplete &&
                      i < workoutSession.session.exerciseIdx
                        ? "var(--paper)"
                        : "var(--sumi)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-display)",
                    fontSize: 14,
                    flexShrink: 0,
                    transition: "background 300ms ease, color 300ms ease",
                  }}
                >
                  {viewingToday &&
                  workoutSession.session &&
                  !completion.isComplete &&
                  i < workoutSession.session.exerciseIdx ? (
                    <Icon name="check" size={16} stroke={2.5} />
                  ) : (
                    i + 1
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: 14.5, color: "var(--ink)" }}>
                      {ex.name}
                    </div>
                    {editingLoadIdx === i ? (
                      <LoadEditor
                        initialLoadLbs={ex.loadLbs}
                        unitSystem={unitSystem}
                        saving={updateLoad.isPending}
                        onCancel={() => setEditingLoadIdx(null)}
                        onSave={async (newLoadLbs) => {
                          await updateLoad.mutateAsync({
                            day: activeDay,
                            index: i,
                            loadLbs: newLoadLbs,
                          });
                          setEditingLoadIdx(null);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingLoadIdx(i)}
                        title="Set a new baseline weight"
                        style={{
                          fontSize: 12,
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                          background: "transparent",
                          border: "1px dashed transparent",
                          padding: "3px 6px",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontFamily: "var(--font-body)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor =
                            "var(--hair)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor =
                            "transparent";
                        }}
                      >
                        {ex.loadLbs !== null
                          ? `${formatLoad(ex.loadLbs, unitSystem)} ${unitLabel}`
                          : "Bodywt"}
                        <Icon name="note" size={11} />
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginTop: 4,
                      display: "flex",
                      gap: 10,
                    }}
                  >
                    <span>
                      <b style={{ color: "var(--sumi)", fontWeight: 500 }}>{ex.sets}</b>{" "}
                      × {ex.reps}
                    </span>
                    <span>·</span>
                    <span>{ex.restSeconds}s rest</span>
                  </div>
                  {ex.notes && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--muted)",
                        marginTop: 6,
                        fontStyle: "italic",
                        paddingLeft: 8,
                        borderLeft: "2px solid var(--hair)",
                      }}
                    >
                      {ex.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {exercises.length > 0 && (
        <div className="px-4 pt-3 space-y-2">
          <Button
            className="w-full"
            variant="accent"
            onClick={() => setWorkoutInProgress(true)}
          >
            <Icon name="dumbbell" size={16} />
            {viewingToday && workoutSession.session && !completion.isComplete
              ? `Resume workout · ${sessProgress.completed} of ${sessProgress.total} sets`
              : "Start workout"}
          </Button>
          {viewingToday && workoutSession.session && !completion.isComplete && (
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: "var(--clay)",
                overflow: "hidden",
                marginTop: -4,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${sessProgress.fraction * 100}%`,
                  background: "var(--accent)",
                  borderRadius: 2,
                  transition: "width 400ms ease",
                }}
              />
            </div>
          )}
          {viewingToday && (
            <Button
              className="w-full"
              variant={completion.isComplete ? "ghost" : "primary"}
              onClick={completion.toggle}
            >
              <Icon name="check" size={16} />
              {completion.isComplete
                ? "Marked complete · Undo"
                : "Mark complete"}
            </Button>
          )}
        </div>
      )}

      <div className="px-4 pt-4 space-y-3">
        {generate.isPending && (
          <GeneratingProgress kind="workout" estimatedSeconds={45} />
        )}
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          <Icon name="sparkle" size={16} />
          {generate.isPending ? "Regenerating…" : "Regenerate plan"}
        </Button>
        {generate.isError && (
          <p style={{ color: "var(--rose)", fontSize: 12.5 }}>
            {(generate.error as Error).message}
          </p>
        )}
      </div>
      </div>
      </div>
    </Layout>
  );
}

/**
 * Inline editor for an exercise's prescribed load. Renders next to the
 * exercise name where the static "135 lb" pill normally sits. Saving
 * patches the active plan AND records a new PR in the progress log so
 * future generated plans anchor to this weight.
 */
function LoadEditor({
  initialLoadLbs,
  unitSystem,
  saving,
  onSave,
  onCancel,
}: {
  initialLoadLbs: number | null;
  unitSystem: UnitSystem;
  saving: boolean;
  onSave: (loadLbs: number) => void | Promise<void>;
  onCancel: () => void;
}) {
  const initialDisplay =
    initialLoadLbs !== null
      ? unitSystem === "metric"
        ? roundTo(poundsToKg(initialLoadLbs), 1)
        : roundTo(initialLoadLbs, 0)
      : "";
  const [value, setValue] = useState<string>(String(initialDisplay));
  const unitLabel = weightUnitLabel(unitSystem);

  function commit() {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    const lbs = unitSystem === "metric" ? kgToPounds(n) : n;
    onSave(roundTo(lbs, 2));
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <input
        autoFocus
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        disabled={saving}
        style={{
          width: 64,
          padding: "4px 6px",
          fontSize: 13,
          border: "1px solid var(--accent)",
          borderRadius: 6,
          fontFamily: "var(--font-body)",
          background: "var(--paper)",
        }}
      />
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{unitLabel}</span>
      <button
        type="button"
        onClick={commit}
        disabled={saving || !value}
        aria-label="Save baseline"
        style={iconBtn("var(--accent)")}
      >
        <Icon name="check" size={12} stroke={2.5} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        aria-label="Cancel"
        style={iconBtn("var(--muted)")}
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}

function iconBtn(color: string): React.CSSProperties {
  return {
    background: "transparent",
    border: "1px solid var(--hair)",
    color,
    padding: 4,
    borderRadius: 6,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function longDay(d: TrainingDay["day"]) {
  return {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday",
  }[d];
}
