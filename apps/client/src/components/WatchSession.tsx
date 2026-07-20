import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { LoadEditor } from "./LoadEditor";
import { useWakeLock } from "../hooks/useWakeLock";
import { useWatchSession, type WatchSessionStatus } from "../hooks/useWatchSession";
import { useWorkoutCompletions } from "../hooks/useWorkoutCompletions";
import { fireCelebration } from "../lib/confetti";
import { formatLoad, weightUnitLabel, type UnitSystem } from "../lib/units";
import type { Exercise } from "../hooks/useWorkoutPlan";

// Full-screen "doing this on my watch" session. The phone is a live reference
// — instructions, tips, and editable weights for today's session — while the
// user runs the workout from their Garmin watch. When they're done they tap
// Finish, which does a single check: Garmin only exposes the activity once
// it's saved and synced, so there's nothing to poll for in the meantime.

interface Props {
  planId: string;
  dayKey: string;
  dayLabel: string;
  focus: string;
  exercises: Exercise[];
  unitSystem: UnitSystem;
  onExit: () => void;
  /** Edit an exercise's prescribed weight (persists to the plan + baseline). */
  onUpdateLoad: (exerciseIdx: number, loadLbs: number) => void;
  /** Fall back to the guided phone walkthrough (resumes at the first gap). */
  onSwitchToPhone: () => void;
}

export function WatchSession({
  planId,
  dayKey,
  dayLabel,
  focus,
  exercises,
  unitSystem,
  onExit,
  onUpdateLoad,
  onSwitchToPhone,
}: Props) {
  const session = useWatchSession(planId, dayKey);
  const completion = useWorkoutCompletions(planId, dayKey);
  useWakeLock(!session.found);

  return (
    // Full-screen takeover in the app's own theme, same pattern as WorkoutMode.
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
      <div
        style={{
          padding: "16px 20px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div className="eyebrow">
          {dayLabel} · {session.found ? "Synced from watch" : "On your watch"}
        </div>
        <button
          type="button"
          onClick={onExit}
          aria-label="Exit watch session"
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

      {session.found ? (
        <FoundScreen
          found={session.found}
          exercises={exercises}
          setsJson={completion.setsJson}
          isComplete={completion.isComplete}
          onExit={onExit}
          onSwitchToPhone={onSwitchToPhone}
        />
      ) : session.status === "reconnect" ? (
        <ReconnectScreen onExit={onExit} onSwitchToPhone={onSwitchToPhone} />
      ) : (
        <ReferenceScreen
          focus={focus}
          exercises={exercises}
          unitSystem={unitSystem}
          status={session.status}
          onUpdateLoad={onUpdateLoad}
          onFinish={session.check}
          onSwitchToPhone={onSwitchToPhone}
        />
      )}
    </div>
  );
}

function ReferenceScreen({
  focus,
  exercises,
  unitSystem,
  status,
  onUpdateLoad,
  onFinish,
  onSwitchToPhone,
}: {
  focus: string;
  exercises: Exercise[];
  unitSystem: UnitSystem;
  // found/reconnect are handled by the parent; only idle/checking/notFound reach here.
  status: WatchSessionStatus;
  onUpdateLoad: (exerciseIdx: number, loadLbs: number) => void;
  onFinish: () => void;
  onSwitchToPhone: () => void;
}) {
  const checking = status === "checking";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 12px" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div className="title-lg">{focus}</div>
          <div className="text-caption" style={{ marginTop: 6 }}>
            Do this on your watch — the details and weights are here for
            reference. Tap Finish when you're done and we'll pull your sets
            from the watch.
          </div>
        </div>

        {exercises.map((ex, i) => (
          <ExerciseReference
            key={i}
            index={i}
            exercise={ex}
            unitSystem={unitSystem}
            onUpdateLoad={onUpdateLoad}
          />
        ))}
      </div>

      <div style={{ padding: "12px 20px 24px", display: "grid", gap: 8 }}>
        {status === "notFound" && (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--sumi)",
              background: "var(--clay)",
              borderRadius: 10,
              padding: "10px 14px",
              lineHeight: 1.5,
            }}
          >
            We couldn't find today's workout on Garmin yet. Save it on your
            watch and let the Garmin Connect app sync, then tap Finish again.
          </div>
        )}
        <Button variant="accent" size="lg" className="w-full" disabled={checking} onClick={onFinish}>
          <Icon name="check" size={16} />
          {checking ? "Checking Garmin…" : status === "notFound" ? "Try again" : "Finish & sync from watch"}
        </Button>
        <Button variant="ghost" className="w-full" onClick={onSwitchToPhone}>
          <Icon name="dumbbell" size={15} />
          Use phone walkthrough instead
        </Button>
      </div>
    </div>
  );
}

function ExerciseReference({
  index,
  exercise,
  unitSystem,
  onUpdateLoad,
}: {
  index: number;
  exercise: Exercise;
  unitSystem: UnitSystem;
  onUpdateLoad: (exerciseIdx: number, loadLbs: number) => void;
}) {
  const [editingLoad, setEditingLoad] = useState(false);
  const unitLabel = weightUnitLabel(unitSystem);

  return (
    <div
      style={{
        padding: "14px 0",
        borderBottom: "1px solid var(--hair)",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          background: "var(--clay)",
          color: "var(--sumi)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-display)",
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        {index + 1}
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
            {exercise.name}
            {exercise.muscleGroup && (
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
                {exercise.muscleGroup}
              </span>
            )}
          </div>
          {exercise.type === "cardio" ? null : editingLoad ? (
            <LoadEditor
              initialLoadLbs={exercise.loadLbs}
              unitSystem={unitSystem}
              saving={false}
              onCancel={() => setEditingLoad(false)}
              onSave={(newLoadLbs) => {
                onUpdateLoad(index, newLoadLbs);
                setEditingLoad(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingLoad(true)}
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
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--hair)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
              }}
            >
              {exercise.loadLbs !== null
                ? `${formatLoad(exercise.loadLbs, unitSystem)} ${unitLabel}`
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
          {exercise.type === "cardio" ? (
            <span>
              <b style={{ color: "var(--sumi)", fontWeight: 500 }}>
                {exercise.durationMinutes ?? "—"}
              </b>{" "}
              min
            </span>
          ) : (
            <>
              <span>
                <b style={{ color: "var(--sumi)", fontWeight: 500 }}>{exercise.sets}</b> ×{" "}
                {exercise.reps}
              </span>
              <span>·</span>
              <span>{exercise.restSeconds}s rest</span>
            </>
          )}
        </div>
        {exercise.description && (
          <div style={{ fontSize: 11.5, color: "var(--sumi)", marginTop: 6, lineHeight: 1.45 }}>
            {exercise.description}
          </div>
        )}
        {exercise.notes && (
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
            {exercise.notes}
          </div>
        )}
      </div>
    </div>
  );
}

function FoundScreen({
  found,
  exercises,
  setsJson,
  isComplete,
  onExit,
  onSwitchToPhone,
}: {
  found: NonNullable<ReturnType<typeof useWatchSession>["found"]>;
  exercises: Exercise[];
  setsJson: Record<string, number[]>;
  isComplete: boolean;
  onExit: () => void;
  onSwitchToPhone: () => void;
}) {
  const celebrated = useRef(false);
  useEffect(() => {
    if (isComplete && !celebrated.current) {
      celebrated.current = true;
      fireCelebration();
    }
  }, [isComplete]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 24px 28px",
        gap: 16,
        overflowY: "auto",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div className="display-hero" style={{ fontSize: "clamp(32px, 9vw, 44px)" }}>
          {isComplete ? "Done." : "Nice work."}
        </div>
        <div className="text-caption" style={{ marginTop: 6 }}>
          {found.activity.activityName}
          {found.activity.durationMinutes != null && ` · ${found.activity.durationMinutes} min`}
          {found.activity.calories != null && ` · ${found.activity.calories} cal`}
        </div>
      </div>

      <div style={{ display: "flex", gap: 28, justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="display-stat" style={{ fontSize: 30 }}>
            {found.matchedSets}/{found.totalPlannedSets}
          </div>
          <div className="eyebrow" style={{ marginTop: 4 }}>
            sets matched
          </div>
        </div>
        {found.unmatchedSets > 0 && (
          <div style={{ textAlign: "center" }}>
            <div className="display-stat" style={{ fontSize: 30 }}>
              {found.unmatchedSets}
            </div>
            <div className="eyebrow" style={{ marginTop: 4 }}>
              extra sets
            </div>
          </div>
        )}
      </div>

      {found.unmatchedSets > 0 && (
        <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", maxWidth: 340 }}>
          {found.unmatchedSets} recorded set{found.unmatchedSets === 1 ? "" : "s"} didn't match a
          planned exercise — they still count in your Garmin activity.
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 360 }}>
        {exercises.map((ex, i) => {
          const done = setsJson[String(i)]?.length ?? 0;
          const exerciseDone = done >= ex.sets;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 2px",
                borderBottom: i < exercises.length - 1 ? "1px solid var(--hair)" : "none",
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: exerciseDone
                    ? "var(--accent)"
                    : done > 0
                      ? "color-mix(in srgb, var(--accent) 20%, var(--clay))"
                      : "var(--clay)",
                  color: exerciseDone ? "var(--paper)" : "var(--sumi)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 12,
                }}
              >
                {exerciseDone ? <Icon name="check" size={14} stroke={2.5} /> : i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>{ex.name}</span>
              <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                {Array.from({ length: ex.sets }, (_, s) => (
                  <span
                    key={s}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: setsJson[String(i)]?.includes(s + 1)
                        ? "var(--accent)"
                        : "var(--hair)",
                    }}
                  />
                ))}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "auto", width: "100%", maxWidth: 360, display: "grid", gap: 8 }}>
        {isComplete ? (
          <Button variant="accent" size="lg" className="w-full" onClick={onExit}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="accent" size="lg" className="w-full" onClick={onSwitchToPhone}>
              <Icon name="dumbbell" size={16} />
              Finish remaining sets on phone
            </Button>
            <Button variant="ghost" className="w-full" onClick={onExit}>
              Done anyway
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ReconnectScreen({
  onExit,
  onSwitchToPhone,
}: {
  onExit: () => void;
  onSwitchToPhone: () => void;
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
        gap: 14,
      }}
    >
      <div className="title-lg">Garmin needs a reconnect</div>
      <p className="text-body" style={{ maxWidth: 320 }}>
        Your Garmin session expired, so we can't pull the workout. Reconnect
        from Profile → Garmin, or finish on the phone — a later sync will still
        pick up the watch activity.
      </p>
      <div style={{ width: "100%", maxWidth: 320, display: "grid", gap: 8, marginTop: 8 }}>
        <Button variant="accent" className="w-full" onClick={onSwitchToPhone}>
          Use phone walkthrough
        </Button>
        <Button variant="ghost" className="w-full" onClick={onExit}>
          Close
        </Button>
      </div>
    </div>
  );
}
