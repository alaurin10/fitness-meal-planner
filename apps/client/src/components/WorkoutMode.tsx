import { useEffect, useRef, useState } from "react";
import { parseRepDuration } from "@platform/shared";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Illustration } from "./Illustration";
import { Ring } from "./Primitives";
import { formatLoad, weightUnitLabel, kgToPounds, poundsToKg, roundTo, type UnitSystem } from "../lib/units";
import { fireCelebration } from "../lib/confetti";
import type { Exercise } from "../hooks/useWorkoutPlan";

interface Props {
  exercises: Exercise[];
  dayLabel: string;
  unitSystem: UnitSystem;
  onExit: () => void;
  /**
   * Called once when the user reaches the Done screen. Lets the host
   * automatically mark the workout complete after guided sessions.
   */
  onComplete?: () => void;
  /** Resume from a saved position (exercise + set). */
  initialExerciseIdx?: number;
  initialSetNum?: number;
  /** Persist the current position on every state change. */
  onProgress?: (exerciseIdx: number, setNum: number) => void;
  /** Clear persisted position (called on workout completion). */
  onSessionClear?: () => void;
  /** Called when a set is completed — persists per-set progress. */
  onSetComplete?: (exerciseIdx: number, setNum: number) => void;
  /**
   * Called when stepping back onto an already-completed set — clears its
   * persisted completion so going backward reduces the saved set count.
   */
  onSetUncomplete?: (exerciseIdx: number, setNum: number) => void;
  /** Called when the user modifies a load in the active screen. */
  onUpdateLoad?: (exerciseIdx: number, loadLbs: number) => void;
}

type Phase = "active" | "resting" | "done";

export function WorkoutMode({
  exercises,
  dayLabel,
  unitSystem,
  onExit,
  onComplete,
  initialExerciseIdx = 0,
  initialSetNum = 1,
  onProgress,
  onSessionClear,
  onSetComplete,
  onSetUncomplete,
  onUpdateLoad,
}: Props) {
  const [exerciseIdx, setExerciseIdx] = useState(initialExerciseIdx);
  const [setNum, setSetNum] = useState(initialSetNum);
  const [phase, setPhase] = useState<Phase>("active");
  const [overviewOpen, setOverviewOpen] = useState(false);
  const completionFiredRef = useRef(false);

  // Fire onComplete the moment the user lands on the Done screen.
  useEffect(() => {
    if (phase === "done" && !completionFiredRef.current) {
      completionFiredRef.current = true;
      onComplete?.();
      onSessionClear?.();
    }
  }, [phase, onComplete, onSessionClear]);

  // Persist position whenever it changes.
  useEffect(() => {
    if (phase !== "done") {
      onProgress?.(exerciseIdx, setNum);
    }
  }, [exerciseIdx, setNum, phase, onProgress]);

  const exercise = exercises[exerciseIdx];
  const totalSets = exercises.reduce((s, e) => s + e.sets, 0);
  const completedSets =
    exercises.slice(0, exerciseIdx).reduce((s, e) => s + e.sets, 0) +
    (phase === "done" ? exercise?.sets ?? 0 : setNum - 1);
  const overallPct = totalSets > 0 ? completedSets / totalSets : 0;

  if (!exercise) return null;

  const isLastSetOfExercise = setNum >= exercise.sets;
  const isLastExercise = exerciseIdx >= exercises.length - 1;
  const isFinalSet = isLastSetOfExercise && isLastExercise;
  const nextExercise = exercises[exerciseIdx + 1];

  function completeSet() {
    onSetComplete?.(exerciseIdx, setNum);
    if (isFinalSet) {
      setPhase("done");
      return;
    }
    setPhase("resting");
  }

  function advanceFromRest() {
    if (isLastSetOfExercise) {
      setExerciseIdx((i) => i + 1);
      setSetNum(1);
    } else {
      setSetNum((n) => n + 1);
    }
    setPhase("active");
  }

  // Jumping rewinds/advances the linear position, exactly like the Back
  // button — jumping back to a finished exercise restarts it at Set 1.
  // Server-side per-set completions (setsJson) are append-only and unaffected.
  function jumpToExercise(idx: number) {
    setExerciseIdx(idx);
    setSetNum(1);
    setPhase("active");
    setOverviewOpen(false);
  }

  const loadLabel =
    exercise.loadLbs !== null
      ? `${formatLoad(exercise.loadLbs, unitSystem)} ${weightUnitLabel(unitSystem)}`
      : "Bodyweight";

  return (
    // Full-screen takeover in the app's own theme — the semantic tokens
    // resolve to whatever light/dark palette the user has chosen.
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
      }}
    >
      {/* Overall progress as a hairline of accent along the top edge */}
      <div
        aria-hidden
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3 }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: `${overallPct * 100}%`,
            background: "linear-gradient(90deg, var(--accent), var(--honey))",
            transition: "width 600ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />
      </div>
      <div
        style={{
          padding: "16px 20px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {phase !== "done" ? (
          <button
            type="button"
            onClick={() => setOverviewOpen(true)}
            aria-label="Workout overview"
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "inherit",
            }}
          >
            <div className="eyebrow">
              {dayLabel} · Exercise {exerciseIdx + 1} of {exercises.length}
            </div>
            <Icon name="list" size={14} style={{ color: "var(--muted)" }} />
          </button>
        ) : (
          <div className="eyebrow">{dayLabel} · Workout</div>
        )}
        <button
          type="button"
          onClick={onExit}
          aria-label="Exit workout mode"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--sumi)",
            cursor: "pointer",
            padding: 6,
          }}
        >
          <Icon name="x" size={20} />
        </button>
      </div>

      <div className="px-5">
        <div
          style={{
            fontSize: 11.5,
            color: "var(--muted)",
            letterSpacing: "0.08em",
          }}
        >
          {completedSets} / {totalSets} SETS DONE
        </div>
      </div>

      {phase === "done" ? (
        <DoneScreen onExit={onExit} totalSets={totalSets} exerciseCount={exercises.length} />
      ) : phase === "resting" ? (
        <RestScreen
          seconds={exercise.restSeconds}
          nextLabel={
            isLastSetOfExercise
              ? `Up next: ${nextExercise!.name} · Set 1 of ${nextExercise!.sets}`
              : `Up next: Set ${setNum + 1} of ${exercise.sets}`
          }
          onContinue={advanceFromRest}
        />
      ) : (
        <ActiveScreen
          exercise={exercise}
          exerciseIdx={exerciseIdx}
          setNum={setNum}
          loadLabel={loadLabel}
          unitSystem={unitSystem}
          onUpdateLoad={onUpdateLoad}
          nextExercise={
            isLastSetOfExercise && nextExercise ? nextExercise : null
          }
        />
      )}

      {phase === "active" && (
        <div
          style={{
            padding: "16px 20px 28px",
            display: "flex",
            gap: 10,
          }}
        >
          <Button
            variant="ghost"
            onClick={() => {
              // Stepping back onto a set means it's the current (incomplete)
              // set again, so clear its persisted completion — keeps the saved
              // set count in sync with the linear position shown in the header.
              if (setNum > 1) {
                const target = setNum - 1;
                onSetUncomplete?.(exerciseIdx, target);
                setSetNum(target);
              } else if (exerciseIdx > 0) {
                const prevIdx = exerciseIdx - 1;
                const prev = exercises[prevIdx]!;
                onSetUncomplete?.(prevIdx, prev.sets);
                setExerciseIdx(prevIdx);
                setSetNum(prev.sets);
              }
            }}
            disabled={exerciseIdx === 0 && setNum === 1}
            style={{ flex: 1 }}
          >
            <Icon
              name="chevron"
              size={14}
              style={{ transform: "rotate(180deg)" }}
            />
            Back
          </Button>
          <Button variant="accent" onClick={completeSet} style={{ flex: 2 }}>
            <Icon name="check" size={16} />
            {isFinalSet ? "Finish workout" : "Complete set"}
          </Button>
        </div>
      )}

      {overviewOpen && (
        <OverviewSheet
          exercises={exercises}
          exerciseIdx={exerciseIdx}
          setNum={setNum}
          onJump={jumpToExercise}
          onClose={() => setOverviewOpen(false)}
        />
      )}
    </div>
  );
}

function OverviewSheet({
  exercises,
  exerciseIdx,
  setNum,
  onJump,
  onClose,
}: {
  exercises: Exercise[];
  exerciseIdx: number;
  setNum: number;
  onJump: (idx: number) => void;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const currentRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Workout overview"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 60,
        display: "flex",
        alignItems: isDesktop ? "center" : "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "75vh",
          background: "var(--bg)",
          borderRadius: isDesktop ? "var(--radius-lg)" : undefined,
          borderTopLeftRadius: isDesktop ? undefined : "var(--radius-lg)",
          borderTopRightRadius: isDesktop ? undefined : "var(--radius-lg)",
          display: "flex",
          flexDirection: "column",
          paddingBottom: isDesktop ? 8 : "calc(env(safe-area-inset-bottom, 16px) + 8px)",
        }}
      >
        <div
          style={{
            padding: "14px 18px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div className="font-display" style={{ fontSize: 20, color: "var(--ink)" }}>
            Workout overview
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--sumi)",
              cursor: "pointer",
              padding: 6,
            }}
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "0 6px" }}>
          {exercises.map((ex, i) => {
            const isDone = i < exerciseIdx;
            const isCurrent = i === exerciseIdx;
            // Same linear derivation as the progress header: sets in the
            // current exercise count as done only once advanced past.
            const doneSets = isDone ? ex.sets : isCurrent ? setNum - 1 : 0;
            return (
              <button
                key={i}
                type="button"
                ref={isCurrent ? currentRef : undefined}
                onClick={() => onJump(i)}
                aria-current={isCurrent ? "true" : undefined}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "13px 12px",
                  background: isCurrent
                    ? "color-mix(in srgb, var(--accent) 7%, transparent)"
                    : "transparent",
                  border: "none",
                  borderBottom: i < exercises.length - 1 ? "1px solid var(--hair)" : "none",
                  borderRadius: isCurrent ? 12 : 0,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: isDone ? "var(--accent)" : "var(--clay)",
                    border: isCurrent ? "2px solid var(--accent)" : "none",
                    color: isDone ? "var(--paper)" : "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  {isDone ? <Icon name="check" size={14} stroke={2.5} /> : i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>
                      {ex.name}
                    </span>
                    {ex.muscleGroup && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "var(--accent-2)",
                          background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                          padding: "2px 8px",
                          borderRadius: 999,
                          letterSpacing: "0.03em",
                          textTransform: "uppercase",
                        }}
                      >
                        {ex.muscleGroup}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginTop: 3,
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <span>
                      <b>{ex.sets}</b> × {ex.reps}
                    </span>
                    <span>·</span>
                    <span>{ex.restSeconds}s rest</span>
                    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                      {Array.from({ length: ex.sets }, (_, s) => (
                        <span
                          key={s}
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: s < doneSets ? "var(--accent)" : "var(--hair)",
                            transition: "background 200ms ease",
                          }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
                <Icon name="chevron" size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActiveScreen({
  exercise,
  exerciseIdx,
  setNum,
  loadLabel,
  unitSystem,
  onUpdateLoad,
  nextExercise,
}: {
  exercise: Exercise;
  exerciseIdx: number;
  setNum: number;
  loadLabel: string;
  unitSystem: UnitSystem;
  onUpdateLoad?: (exerciseIdx: number, loadLbs: number) => void;
  nextExercise: Exercise | null;
}) {
  const [editingLoad, setEditingLoad] = useState(false);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px 28px",
        textAlign: "center",
        gap: 18,
      }}
    >
      <div className="eyebrow" style={{ opacity: 0.8 }}>
        Set {setNum} of {exercise.sets}
      </div>
      <div
        className="display-hero"
        style={{
          fontSize: "clamp(30px, 8.5vw, 42px)",
          lineHeight: 1.05,
          maxWidth: 420,
        }}
      >
        {exercise.name}
      </div>
      {exercise.muscleGroup && (
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: "var(--accent-2)",
            background: "color-mix(in srgb, var(--accent) 12%, transparent)",
            padding: "3px 10px",
            borderRadius: 999,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
          }}
        >
          {exercise.muscleGroup}
        </span>
      )}
      {/* Set indicator dots */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {Array.from({ length: exercise.sets }, (_, i) => {
          const num = i + 1;
          const isDone = num < setNum;
          const isCurrent = num === setNum;
          return (
            <div
              key={i}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: isDone ? "var(--accent)" : isCurrent ? "var(--clay)" : "transparent",
                border: isDone ? "2px solid var(--accent)" : "2px solid var(--hair)",
                color: isDone ? "var(--paper)" : isCurrent ? "var(--ink)" : "var(--muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "var(--font-body)",
                transition: "all 300ms ease",
                animation: isDone ? "checkPop 260ms ease" : undefined,
              }}
            >
              {isDone ? <Icon name="check" size={14} stroke={2.5} /> : num}
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "baseline",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {(() => {
          const duration = parseRepDuration(exercise.reps);
          return duration !== null ? (
            <RepTimer
              key={`${exerciseIdx}-${setNum}`}
              seconds={duration.seconds}
              perSide={duration.perSide}
            />
          ) : (
            <Stat label="Reps" value={exercise.reps} />
          );
        })()}
        {editingLoad && onUpdateLoad ? (
          <LoadEditor
            initialLoadLbs={exercise.loadLbs}
            unitSystem={unitSystem}
            onSave={(newLbs) => {
              onUpdateLoad(exerciseIdx, newLbs);
              setEditingLoad(false);
            }}
            onCancel={() => setEditingLoad(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => onUpdateLoad && setEditingLoad(true)}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: onUpdateLoad ? "pointer" : "default",
              textAlign: "center",
            }}
          >
            <Stat label="Load" value={loadLabel} />
          </button>
        )}
      </div>
      {exercise.description && (
        <div
          style={{
            fontSize: 13,
            color: "var(--sumi)",
            maxWidth: 360,
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          {exercise.description}
        </div>
      )}
      {exercise.notes && (
        <div
          style={{
            fontSize: 13,
            color: "var(--sumi)",
            fontStyle: "italic",
            maxWidth: 360,
            lineHeight: 1.5,
            padding: "10px 14px",
            borderLeft: "2px solid var(--hair)",
            textAlign: "left",
          }}
        >
          {exercise.notes}
        </div>
      )}
      {nextExercise && (
        <div
          style={{
            marginTop: 12,
            width: "100%",
            maxWidth: 420,
            padding: "10px 14px",
            background: "var(--paper)",
            border: "1px solid var(--hair)",
            borderRadius: 12,
            opacity: 0.75,
            textAlign: "left",
          }}
        >
          <div className="eyebrow" style={{ opacity: 0.7 }}>
            Up next
          </div>
          <div
            style={{
              fontSize: 14,
              color: "var(--ink)",
              marginTop: 2,
              fontWeight: 500,
            }}
          >
            {nextExercise.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {nextExercise.sets} × {nextExercise.reps}
          </div>
        </div>
      )}
    </div>
  );
}

function RestScreen({
  seconds,
  nextLabel,
  onContinue,
}: {
  seconds: number;
  nextLabel: string;
  onContinue: () => void;
}) {
  // Anchor the countdown to a wall-clock deadline rather than decrementing a
  // counter on each tick. Mobile browsers throttle setInterval when the tab is
  // backgrounded, so a tick-based timer effectively pauses; reading Date.now()
  // gives the correct remaining seconds the moment the page is foregrounded.
  const [deadline, setDeadline] = useState(() => Date.now() + seconds * 1000);
  const [remaining, setRemaining] = useState(seconds);
  const finishedRef = useRef(false);

  useEffect(() => {
    finishedRef.current = false;
    const target = Date.now() + seconds * 1000;
    setDeadline(target);
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
    };
    tick();
    const id = window.setInterval(tick, 250);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [deadline]);

  // Auto-advance once the timer reaches 0 (only fire once).
  useEffect(() => {
    if (remaining === 0 && !finishedRef.current) {
      finishedRef.current = true;
      // Brief pause so user sees "0:00" before the next set appears.
      const id = window.setTimeout(onContinue, 500);
      return () => window.clearTimeout(id);
    }
  }, [remaining, onContinue]);

  const mm = Math.floor(remaining / 60).toString();
  const ss = (remaining % 60).toString().padStart(2, "0");
  const done = remaining === 0;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px 28px",
        textAlign: "center",
        gap: 18,
      }}
    >
      <div className="eyebrow" style={{ opacity: 0.8 }}>
        Rest
      </div>
      {/* Breathing countdown ring — drains as the rest elapses */}
      <div style={{ animation: done ? undefined : "breathe 4s ease-in-out infinite" }}>
        <Ring
          value={seconds > 0 ? remaining / seconds : 0}
          size={190}
          stroke={9}
          gradient
        >
          <span
            className="font-display"
            style={{
              fontSize: 52,
              color: done ? "var(--accent)" : "var(--ink)",
              letterSpacing: "0.02em",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {mm}:{ss}
          </span>
        </Ring>
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--sumi)",
          maxWidth: 320,
          lineHeight: 1.5,
        }}
      >
        {nextLabel}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <Button variant="ghost" onClick={() => setRemaining((r) => r + 15)}>
          <Icon name="plus" size={14} />
          15s
        </Button>
        <Button variant="accent" onClick={onContinue}>
          <Icon name="check" size={14} />
          {done ? "Continue" : "Skip rest"}
        </Button>
      </div>
    </div>
  );
}

function DoneScreen({
  onExit,
  totalSets,
  exerciseCount,
}: {
  onExit: () => void;
  totalSets: number;
  exerciseCount: number;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      fireCelebration();
    }
  }, []);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px 28px",
        textAlign: "center",
        gap: 18,
      }}
    >
      <Illustration name="workout-done" size={190} className="fade-up" />
      <div className="display-hero" style={{ fontSize: "clamp(38px, 11vw, 52px)" }}>
        Done.
      </div>
      <div style={{ display: "flex", gap: 32, justifyContent: "center" }}>
        <div>
          <div className="display-stat" style={{ fontSize: 34 }}>{totalSets}</div>
          <div className="eyebrow" style={{ marginTop: 4 }}>sets</div>
        </div>
        <div>
          <div className="display-stat" style={{ fontSize: 34 }}>{exerciseCount}</div>
          <div className="eyebrow" style={{ marginTop: 4 }}>exercises</div>
        </div>
      </div>
      <p className="text-body" style={{ maxWidth: 320 }}>
        Nicely done. Log your weight on the progress page so the next plan
        evolves with you.
      </p>
      <Button variant="accent" size="lg" onClick={onExit} style={{ minWidth: 180 }}>
        Done
      </Button>
    </div>
  );
}

function LoadEditor({
  initialLoadLbs,
  unitSystem,
  onSave,
  onCancel,
}: {
  initialLoadLbs: number | null;
  unitSystem: UnitSystem;
  onSave: (loadLbs: number) => void;
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
    <div style={{ textAlign: "center" }}>
      <div className="eyebrow">Load</div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginTop: 4,
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
          style={{
            width: 80,
            padding: "6px 8px",
            fontSize: 20,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            border: "1px solid var(--accent)",
            borderRadius: 8,
            background: "var(--paper)",
            color: "var(--ink)",
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}
        />
        <span style={{ fontSize: 14, color: "var(--muted)" }}>{unitLabel}</span>
      </div>
    </div>
  );
}

function RepTimer({ seconds, perSide }: { seconds: number; perSide?: boolean }) {
  const [started, setStarted] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (!started) return;
    const target = Date.now() + seconds * 1000;
    setDeadline(target);
    setRemaining(seconds);
  }, [started, seconds]);

  useEffect(() => {
    if (!started) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
    };
    tick();
    const id = window.setInterval(tick, 250);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [started, deadline]);

  const mm = Math.floor(remaining / 60).toString();
  const ss = (remaining % 60).toString().padStart(2, "0");
  const done = started && remaining === 0;

  return (
    <div style={{ textAlign: "center" }}>
      <div className="eyebrow">{perSide ? "Rep Timer · Per Side" : "Rep Timer"}</div>
      <div
        className="font-display"
        style={{
          fontSize: 64,
          color: done ? "var(--accent)" : "var(--ink)",
          letterSpacing: "0.02em",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
          marginTop: 4,
        }}
      >
        {mm}:{ss}
      </div>
      {!started && (
        <Button
          variant="ghost"
          onClick={() => setStarted(true)}
          style={{ marginTop: 10 }}
        >
          Start
        </Button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div
        className="display-stat"
        style={{
          fontSize: 40,
          marginTop: 2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
