import { useMemo, useState } from "react";
import { rotateDays, dayIdxFromDate, startOfWeek as sharedStartOfWeek, addWeeks, localDayKey, parseLocalDate, type DayLabel } from "@platform/shared";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { DaySelector } from "../components/DaySelector";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { GeneratingProgress } from "../components/GeneratingProgress";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { PlanInfo } from "../components/PlanInfo";
import { Illustration } from "../components/Illustration";
import { PageHero } from "../components/Primitives";
import { SkeletonList } from "../components/Skeleton";
import { WeekSelector } from "../components/WeekSelector";
import { WatchSession } from "../components/WatchSession";
import { WorkoutMode } from "../components/WorkoutMode";
import { useSwipe } from "../hooks/useSwipe";
import { success, tap } from "../lib/haptics";
import { useActivities, useLogActivity, useDeleteActivity } from "../hooks/useActivities";
import { useGarminStatus, usePushWeekToGarmin } from "../hooks/useGarmin";
import { useToast } from "../components/Toast";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useSettings } from "../hooks/useSettings";
import { useWeekStartDay } from "../hooks/useWeekStartDay";
import {
  useCurrentWorkoutPlan,
  useGenerateWorkoutPlan,
  useUpdateExerciseLoad,
  type TrainingDay,
} from "../hooks/useWorkoutPlan";
import {
  completionProgress,
  findResumePosition,
  useWorkoutCompletions,
} from "../hooks/useWorkoutCompletions";
import { ProgressRing } from "../components/ProgressRing";
import {
  distanceUnitLabel,
  formatDistance,
  formatLoad,
  kmToMiles,
  kgToPounds,
  poundsToKg,
  roundTo,
  weightUnitLabel,
  type UnitSystem,
} from "../lib/units";

export function WorkoutsPage() {
  const weekStartDay = useWeekStartDay();
  const DAYS = rotateDays(weekStartDay);
  const now = useMemo(() => new Date(), []);
  const thisWeekStart = useMemo(() => localDayKey(sharedStartOfWeek(now, weekStartDay)), [now, weekStartDay]);
  const nextWeekStart = useMemo(
    () => localDayKey(addWeeks(sharedStartOfWeek(now, weekStartDay), 1)),
    [now, weekStartDay],
  );
  const [viewingWeekStart, setViewingWeekStart] = useState(thisWeekStart);
  const viewingWeekStartDate = useMemo(() => parseLocalDate(viewingWeekStart), [viewingWeekStart]);

  const { data: plan, isLoading } = useCurrentWorkoutPlan(viewingWeekStart);
  const settingsQuery = useSettings();
  const generate = useGenerateWorkoutPlan();
  const todayIdx = dayIdxFromDate(now, weekStartDay);
  const [activeDay, setActiveDay] = useState<TrainingDay["day"]>(
    DAYS[todayIdx] ?? "Mon",
  );
  const activeDayIdx = DAYS.indexOf(activeDay);
  // Calendar date of the selected day within the *viewed* week, so
  // completions land on next week's dates when that tab is active.
  const activeDayKey = useMemo(() => {
    const d = new Date(viewingWeekStartDate);
    d.setDate(d.getDate() + activeDayIdx);
    return localDayKey(d);
  }, [viewingWeekStartDate, activeDayIdx]);
  const [workoutInProgress, setWorkoutInProgress] = useState(false);
  // "Doing this on my watch" live session — waits for the saved Garmin
  // activity and syncs its sets back instead of a phone walkthrough.
  const [watchMode, setWatchMode] = useState(false);
  const completion = useWorkoutCompletions(plan?.id, activeDayKey);
  const updateLoad = useUpdateExerciseLoad();
  const [editingLoadIdx, setEditingLoadIdx] = useState<number | null>(null);
  const isDesktop = useIsDesktop();
  const unitSystem = settingsQuery.data?.unitSystem ?? "imperial";
  const [showActivityForm, setShowActivityForm] = useState(false);
  const activitiesQuery = useActivities();
  const logActivity = useLogActivity();
  const deleteActivity = useDeleteActivity();
  const garminStatus = useGarminStatus();
  const pushWeek = usePushWeekToGarmin();
  const toast = useToast();
  const unitLabel = weightUnitLabel(unitSystem);
  // Directional slide when switching days (swipe or pill tap).
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);

  function changeDay(next: TrainingDay["day"]) {
    if (next === activeDay) return;
    setSlideDir(DAYS.indexOf(next) > DAYS.indexOf(activeDay) ? "left" : "right");
    setActiveDay(next);
  }

  function stepDay(delta: 1 | -1) {
    const next = DAYS[DAYS.indexOf(activeDay) + delta];
    if (next) changeDay(next);
  }

  const swipe = useSwipe({
    onSwipeLeft: () => stepDay(1),
    onSwipeRight: () => stepDay(-1),
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="px-4 py-4">
          <SkeletonList count={4} />
        </div>
      </Layout>
    );
  }

  if (!plan) {
    return (
      <Layout>
        <PageHero
          title="Workouts"
          subtitle="No active plan yet."
          right={
            <WeekSelector
              viewingWeekStart={viewingWeekStart}
              thisWeekStart={thisWeekStart}
              nextWeekStart={nextWeekStart}
              onChange={setViewingWeekStart}
            />
          }
        />
        <div className="px-4 pt-2 space-y-3">
          {generate.isPending ? (
            <GeneratingProgress kind="workout" estimatedSeconds={45} />
          ) : (
            <EmptyState
              illustration="no-plan"
              title="No active plan"
              body="Generate a training week tailored to your goals, split, and equipment."
            >
              <Button
                className="w-full mt-5"
                onClick={() => generate.mutate({ targetWeekStart: viewingWeekStart })}
              >
                <Icon name="sparkle" size={16} />
                Generate plan
              </Button>
              {generate.isError && (
                <ErrorState
                  compact
                  error={generate.error}
                  retrying={generate.isPending}
                  onRetry={() => generate.mutate({ targetWeekStart: viewingWeekStart })}
                />
              )}
            </EmptyState>
          )}
        </div>

        <div className="px-4 pt-6">
          <div className="section-title" style={{ marginBottom: 10 }}>Log an activity</div>
          {!showActivityForm ? (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowActivityForm(true)}
            >
              <Icon name="plus" size={16} />
              Log activity
            </Button>
          ) : (
            <ActivityForm
              unitSystem={unitSystem}
              saving={logActivity.isPending}
              onSave={async (input) => {
                await logActivity.mutateAsync(input);
                setShowActivityForm(false);
              }}
              onCancel={() => setShowActivityForm(false)}
            />
          )}
          {logActivity.isError && (
            <p style={{ color: "var(--rose)", fontSize: 12.5, marginTop: 8 }}>
              {(logActivity.error as Error).message}
            </p>
          )}
        </div>

        {activitiesQuery.data && activitiesQuery.data.length > 0 && (
          <div className="px-4 pt-4">
            <div className="section-title" style={{ marginBottom: 10 }}>Recent activities</div>
            <Card flush>
              {activitiesQuery.data.slice(0, 20).map((a, i, arr) => (
                <div
                  key={a.id}
                  style={{
                    padding: "14px 18px",
                    borderBottom: i < arr.length - 1 ? "1px solid var(--hair)" : "none",
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: "var(--clay)",
                      color: "var(--sumi)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="flame" size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <div style={{ fontWeight: 500, fontSize: 14.5, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.activityName}</span>
                        {a.source === "garmin" && (
                          <span
                            title="Synced from Garmin — deleting it here brings it back on the next sync"
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              color: "var(--accent-2)",
                              border: "1px solid var(--hair)",
                              borderRadius: 999,
                              padding: "1px 7px",
                              flexShrink: 0,
                            }}
                          >
                            Garmin
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label="Delete activity"
                        onClick={() => deleteActivity.mutate(a.id)}
                        disabled={deleteActivity.isPending}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--muted)",
                          cursor: "pointer",
                          padding: 4,
                          borderRadius: 6,
                          flexShrink: 0,
                        }}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                      {new Date(a.performedAt).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6, fontSize: 12, color: "var(--sumi)" }}>
                      {a.durationMinutes != null && (
                        <span>{a.durationMinutes} min</span>
                      )}
                      {a.activeCalories != null && (
                        <span>{a.activeCalories} cal</span>
                      )}
                      {a.distanceMiles != null && (
                        <span>
                          {formatDistance(a.distanceMiles, unitSystem)} {distanceUnitLabel(unitSystem)}
                        </span>
                      )}
                    </div>
                    {a.note && (
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
                        {a.note}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </Layout>
    );
  }

  const dayEntry = plan.planJson.days.find((d) => d.day === activeDay);
  const exercises = dayEntry?.exercises ?? [];
  const viewingToday =
    viewingWeekStart === thisWeekStart && activeDay === DAYS[todayIdx];

  const sessProgress = completionProgress(completion.setsJson, exercises);

  if (watchMode && exercises.length > 0) {
    return (
      <WatchSession
        planId={plan.id}
        dayKey={activeDayKey}
        dayLabel={longDay(activeDay)}
        focus={dayEntry?.focus ?? "Workout"}
        exercises={exercises}
        onExit={() => setWatchMode(false)}
        onSwitchToPhone={() => {
          setWatchMode(false);
          setWorkoutInProgress(true);
        }}
      />
    );
  }

  if (workoutInProgress && exercises.length > 0) {
    const resumeAt = findResumePosition(exercises, completion.setsJson);
    return (
      <WorkoutMode
        exercises={exercises}
        dayLabel={longDay(activeDay)}
        unitSystem={unitSystem}
        initialExerciseIdx={resumeAt?.exerciseIdx}
        initialSetNum={resumeAt?.setNum}
        onExit={() => setWorkoutInProgress(false)}
        onSetComplete={
          viewingToday
            ? (...args: Parameters<typeof completion.markSetComplete>) => {
                tap();
                completion.markSetComplete(...args);
              }
            : undefined
        }
        onSetUncomplete={
          viewingToday ? completion.unmarkSetComplete : undefined
        }
        onUpdateLoad={(idx, loadLbs) =>
          updateLoad.mutate({ day: activeDay, index: idx, loadLbs })
        }
        onComplete={
          // Only auto-mark complete when the user is doing today's session.
          // Browsing a future/past day is just preview.
          viewingToday && !completion.isComplete
            ? () => {
                success();
                completion.markComplete();
              }
            : undefined
        }
      />
    );
  }

  return (
    <Layout>
      <PageHero
        title="Workouts"
        right={
          <WeekSelector
            viewingWeekStart={viewingWeekStart}
            thisWeekStart={thisWeekStart}
            nextWeekStart={nextWeekStart}
            onChange={setViewingWeekStart}
          />
        }
      />

      <div style={isDesktop ? { display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, padding: "0 16px" } : undefined}>
      <DaySelector
        days={DAYS}
        counts={DAYS.map(
          (d) => plan.planJson.days.find((pd) => pd.day === d)?.exercises.length ?? 0,
        )}
        activeDay={activeDay}
        todayDay={DAYS[todayIdx]}
        weekStartDate={viewingWeekStartDate}
        onChange={changeDay}
        isDesktop={isDesktop}
      />

      <div
        key={activeDay}
        className={
          slideDir ? (slideDir === "left" ? "slide-in-left" : "slide-in-right") : undefined
        }
        {...swipe}
      >
      <div className="px-4 pt-2">
        <Card tone="hero">
          {/* Plan-level info lives on the week card, not the masthead — it
              describes the plan being viewed, and the tab header stays a
              single uncrowded row. */}
          <div className="flex items-center justify-between gap-3" style={{ marginBottom: 2 }}>
            <div className="eyebrow">{longDay(activeDay)}</div>
            <div style={{ marginTop: -4, marginRight: -4 }}>
              <PlanInfo
                title="About this plan"
                sections={[
                  { text: plan.planJson.summary },
                  { label: "Progression", text: plan.planJson.progressionNotes },
                ]}
              />
            </div>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="title-lg mt-1">{dayEntry?.focus ?? "Rest"}</div>
              <div className="text-caption" style={{ marginTop: 6 }}>
                {exercises.length
                  ? `${exercises.length} exercises planned.`
                  : "A calm day — recover well."}
              </div>
            </div>
            {exercises.length === 0 ? (
              <Illustration name="rest-day" size={92} style={{ flexShrink: 0, marginBottom: -8 }} />
            ) : viewingToday && sessProgress.completed > 0 && !completion.isComplete ? (
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

        {/* Garmin-only: schedule this week's sessions on the watch */}
        {garminStatus.data?.connected && (
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="ghost"
              disabled={pushWeek.isPending}
              onClick={() =>
                pushWeek.mutate(plan.id, {
                  onSuccess: (days) => {
                    const ok = days.filter((d) => d.scheduled).length;
                    const failed = days.length - ok;
                    if (failed === 0) {
                      toast.success(
                        ok > 0
                          ? `Sent ${ok} workout${ok === 1 ? "" : "s"} to your watch — they're on your Garmin calendar.`
                          : "No training days to send this week.",
                      );
                    } else {
                      toast.error(
                        `Sent ${ok}/${days.length} workouts — ${days.find((d) => d.error)?.error ?? "some days failed"}`,
                      );
                    }
                  },
                  onError: (err) => {
                    const axiosMsg = (err as { response?: { data?: { error?: string } } })
                      .response?.data?.error;
                    toast.error(axiosMsg ?? (err as Error).message);
                  },
                })
              }
            >
              <Icon name="chevron" size={14} />
              {pushWeek.isPending ? "Sending to watch…" : "Send week to watch"}
            </Button>
          </div>
        )}
      </div>

      {exercises.length > 0 && (
        <div className="px-4 pt-3">
          <Card flush className="stagger-in">
            {exercises.map((ex, i) => {
              const exerciseSets = completion.setsJson[String(i)] ?? [];
              const exerciseDone = exerciseSets.length >= ex.sets;
              const hasPartial = exerciseSets.length > 0 && !exerciseDone;
              return (
              <div
                key={i}
                style={{
                  padding: "16px 18px",
                  borderBottom:
                    i < exercises.length - 1 ? "1px solid var(--hair)" : "none",
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  opacity: viewingToday && exerciseDone ? 0.5 : 1,
                  transition: "opacity 300ms ease",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: exerciseDone
                      ? "var(--accent)"
                      : hasPartial
                        ? "color-mix(in srgb, var(--accent) 20%, var(--clay))"
                        : "var(--clay)",
                    color: exerciseDone
                      ? "var(--paper)"
                      : "var(--sumi)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-display)",
                    fontSize: 14,
                    flexShrink: 0,
                    transition: "background 300ms ease, color 300ms ease",
                    animation: exerciseDone ? "checkPop 260ms ease" : undefined,
                  }}
                >
                  {exerciseDone ? (
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
                      {ex.muscleGroup && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: "var(--accent-2)",
                            background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                            padding: "2px 7px",
                            borderRadius: 999,
                            verticalAlign: "middle",
                            letterSpacing: "0.03em",
                            textTransform: "uppercase",
                          }}
                        >
                          {ex.muscleGroup}
                        </span>
                      )}
                    </div>
                    {ex.type === "cardio" ? null : editingLoadIdx === i ? (
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
                      alignItems: "center",
                    }}
                  >
                    {ex.type === "cardio" ? (
                      <span>
                        <b style={{ color: "var(--sumi)", fontWeight: 500 }}>
                          {ex.durationMinutes ?? "—"}
                        </b>{" "}
                        min
                      </span>
                    ) : (
                      <>
                        <span>
                          <b style={{ color: "var(--sumi)", fontWeight: 500 }}>{ex.sets}</b>{" "}
                          × {ex.reps}
                        </span>
                        <span>·</span>
                        <span>{ex.restSeconds}s rest</span>
                      </>
                    )}
                    {viewingToday && exerciseSets.length > 0 && (
                      <>
                        <span>·</span>
                        <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                          {Array.from({ length: ex.sets }, (_, s) => (
                            <span
                              key={s}
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                background: exerciseSets.includes(s + 1) ? "var(--accent)" : "var(--hair)",
                                transition: "background 200ms ease",
                              }}
                            />
                          ))}
                        </span>
                      </>
                    )}
                  </div>
                  {ex.description && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--sumi)",
                        marginTop: 6,
                        lineHeight: 1.45,
                      }}
                    >
                      {ex.description}
                    </div>
                  )}
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
              );
            })}
          </Card>
        </div>
      )}

      {exercises.length > 0 && (
        <div className="px-4 pt-3 space-y-2">
          <Button
            className="w-full"
            variant="accent"
            size="lg"
            onClick={() => setWorkoutInProgress(true)}
          >
            <Icon name="dumbbell" size={16} />
            {viewingToday && sessProgress.completed > 0 && !completion.isComplete
              ? `Resume workout · ${sessProgress.completed} of ${sessProgress.total} sets`
              : completion.isComplete && viewingToday
                ? "Workout complete ✓"
                : "Start workout"}
          </Button>
          {garminStatus.data?.connected && viewingToday && !completion.isComplete && (
            <Button variant="ghost" className="w-full" onClick={() => setWatchMode(true)}>
              <Icon name="timer" size={15} />
              I'm doing this on my watch
            </Button>
          )}
          {viewingToday && sessProgress.completed > 0 && !completion.isComplete && (
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: "var(--clay)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${sessProgress.total > 0 ? (sessProgress.completed / sessProgress.total) * 100 : 0}%`,
                  background: "var(--accent)",
                  borderRadius: 2,
                  transition: "width 400ms ease",
                }}
              />
            </div>
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
          onClick={() => generate.mutate({ targetWeekStart: viewingWeekStart })}
          disabled={generate.isPending}
        >
          <Icon name="sparkle" size={16} />
          {generate.isPending ? "Regenerating…" : "Regenerate plan"}
        </Button>
        {generate.isError && (
          <ErrorState
            compact
            error={generate.error}
            retrying={generate.isPending}
            onRetry={() => generate.mutate({ targetWeekStart: viewingWeekStart })}
          />
        )}
      </div>

      <div className="px-4 pt-6">
        <div className="section-title" style={{ marginBottom: 10 }}>Log an activity</div>
        {!showActivityForm ? (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setShowActivityForm(true)}
          >
            <Icon name="plus" size={16} />
            Log activity
          </Button>
        ) : (
          <ActivityForm
            unitSystem={unitSystem}
            saving={logActivity.isPending}
            onSave={async (input) => {
              await logActivity.mutateAsync(input);
              setShowActivityForm(false);
            }}
            onCancel={() => setShowActivityForm(false)}
          />
        )}
        {logActivity.isError && (
          <p style={{ color: "var(--rose)", fontSize: 12.5, marginTop: 8 }}>
            {(logActivity.error as Error).message}
          </p>
        )}
      </div>

      {activitiesQuery.data && activitiesQuery.data.length > 0 && (
        <div className="px-4 pt-4">
          <div className="section-title" style={{ marginBottom: 10 }}>Recent activities</div>
          <Card flush>
            {activitiesQuery.data.slice(0, 20).map((a, i, arr) => (
              <div
                key={a.id}
                style={{
                  padding: "14px 18px",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--hair)" : "none",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: "var(--clay)",
                    color: "var(--sumi)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="flame" size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <div style={{ fontWeight: 500, fontSize: 14.5, color: "var(--ink)" }}>
                      {a.activityName}
                    </div>
                    <button
                      type="button"
                      aria-label="Delete activity"
                      onClick={() => deleteActivity.mutate(a.id)}
                      disabled={deleteActivity.isPending}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--muted)",
                        cursor: "pointer",
                        padding: 4,
                        borderRadius: 6,
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                    {new Date(a.performedAt).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6, fontSize: 12, color: "var(--sumi)" }}>
                    {a.durationMinutes != null && (
                      <span>{a.durationMinutes} min</span>
                    )}
                    {a.activeCalories != null && (
                      <span>{a.activeCalories} cal</span>
                    )}
                    {a.distanceMiles != null && (
                      <span>
                        {formatDistance(a.distanceMiles, unitSystem)} {distanceUnitLabel(unitSystem)}
                      </span>
                    )}
                  </div>
                  {a.note && (
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
                      {a.note}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
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
    if (!Number.isFinite(n) || n <= 0) {
      onCancel();
      return;
    }
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
        onBlur={commit}
        disabled={saving}
        style={{
          width: 72,
          padding: "4px 6px",
          // 16px min avoids iOS Safari's auto-zoom on focus.
          fontSize: 16,
          border: "1px solid var(--accent)",
          borderRadius: 6,
          fontFamily: "var(--font-body)",
          background: "var(--paper)",
        }}
      />
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{unitLabel}</span>
    </div>
  );
}

function toLocalDatetimeValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ActivityFormInput {
  activityName: string;
  performedAt: string;
  durationMinutes?: number | null;
  activeCalories?: number | null;
  distanceMiles?: number | null;
  note?: string;
}

function ActivityForm({
  unitSystem,
  saving,
  onSave,
  onCancel,
}: {
  unitSystem: UnitSystem;
  saving: boolean;
  onSave: (input: ActivityFormInput) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [performedAt, setPerformedAt] = useState(toLocalDatetimeValue(new Date()));
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");
  const [distance, setDistance] = useState("");
  const [note, setNote] = useState("");

  const distLabel = distanceUnitLabel(unitSystem);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const durationVal = duration ? parseInt(duration, 10) : null;
    const caloriesVal = calories ? parseInt(calories, 10) : null;
    let distanceVal: number | null = null;
    if (distance) {
      const parsed = parseFloat(distance);
      if (Number.isFinite(parsed) && parsed > 0) {
        distanceVal = unitSystem === "metric" ? kmToMiles(parsed) : parsed;
      }
    }

    onSave({
      activityName: name.trim(),
      performedAt: new Date(performedAt).toISOString(),
      durationMinutes: durationVal && durationVal > 0 ? durationVal : null,
      activeCalories: caloriesVal && caloriesVal > 0 ? caloriesVal : null,
      distanceMiles: distanceVal,
      note: note.trim() || undefined,
    });
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 14,
    border: "1px solid var(--hair)",
    borderRadius: 8,
    fontFamily: "var(--font-body)",
    background: "var(--paper)",
    color: "var(--ink)",
  };

  return (
    <Card>
      <form onSubmit={submit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
              Activity *
            </label>
            <input
              type="text"
              placeholder="e.g. Bike ride, Morning run, Yoga"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              disabled={saving}
              style={fieldStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
              Date & time
            </label>
            <input
              type="datetime-local"
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
              disabled={saving}
              style={fieldStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Duration (min)
              </label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="—"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min={1}
                disabled={saving}
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Calories
              </label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="—"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                min={1}
                disabled={saving}
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Distance ({distLabel})
              </label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="—"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                min={0}
                step="any"
                disabled={saving}
                style={fieldStyle}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
              Note
            </label>
            <input
              type="text"
              placeholder="Optional note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              disabled={saving}
              style={fieldStyle}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Button type="submit" variant="accent" className="flex-1" disabled={saving || !name.trim()}>
              <Icon name="check" size={16} />
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
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
