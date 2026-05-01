import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { formatLoad, weightUnitLabel, type UnitSystem } from "../lib/units";
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
}: Props) {
  const [exerciseIdx, setExerciseIdx] = useState(initialExerciseIdx);
  const [setNum, setSetNum] = useState(initialSetNum);
  const [phase, setPhase] = useState<Phase>("active");
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

  const loadLabel =
    exercise.loadLbs !== null
      ? `${formatLoad(exercise.loadLbs, unitSystem)} ${weightUnitLabel(unitSystem)}`
      : "Bodyweight";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
      }}
    >
      <div
        style={{
          padding: "16px 20px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div className="eyebrow">
          {dayLabel} · {exercise.name && phase !== "done" ? `Exercise ${exerciseIdx + 1} of ${exercises.length}` : "Workout"}
        </div>
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
        <div className="prog">
          <span style={{ width: `${overallPct * 100}%` }} />
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--muted)",
            marginTop: 6,
            letterSpacing: "0.08em",
          }}
        >
          {completedSets} / {totalSets} SETS DONE
        </div>
      </div>

      {phase === "done" ? (
        <DoneScreen onExit={onExit} />
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
          setNum={setNum}
          loadLabel={loadLabel}
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
              if (setNum > 1) {
                setSetNum((n) => n - 1);
              } else if (exerciseIdx > 0) {
                const prev = exercises[exerciseIdx - 1]!;
                setExerciseIdx((i) => i - 1);
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
    </div>
  );
}

function ActiveScreen({
  exercise,
  setNum,
  loadLabel,
  nextExercise,
}: {
  exercise: Exercise;
  setNum: number;
  loadLabel: string;
  nextExercise: Exercise | null;
}) {
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
        className="font-display"
        style={{
          fontSize: 30,
          color: "var(--ink)",
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
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
        <Stat label="Reps" value={exercise.reps} />
        <Stat label="Load" value={loadLabel} />
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
      <div
        className="font-display"
        style={{
          fontSize: 88,
          color: done ? "var(--accent)" : "var(--ink)",
          letterSpacing: "0.02em",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {mm}:{ss}
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

function DoneScreen({ onExit }: { onExit: () => void }) {
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
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: "var(--accent)",
          color: "var(--paper)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "checkPop 400ms ease",
          boxShadow: "0 0 0 8px color-mix(in srgb, var(--accent) 15%, transparent)",
        }}
      >
        <Icon name="check" size={44} stroke={2.5} />
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 32,
          color: "var(--ink)",
          letterSpacing: "-0.01em",
        }}
      >
        Workout complete!
      </div>
      <p style={{ fontSize: 13.5, color: "var(--sumi)", maxWidth: 320 }}>
        Nicely done. Log your weight on the progress page so the next plan
        evolves with you.
      </p>
      <Button variant="accent" onClick={onExit} style={{ minWidth: 160 }}>
        Done
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div
        className="font-display"
        style={{
          fontSize: 28,
          color: "var(--ink)",
          letterSpacing: "-0.01em",
          marginTop: 2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
