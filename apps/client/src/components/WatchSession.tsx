import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { useWakeLock } from "../hooks/useWakeLock";
import { useWatchSession } from "../hooks/useWatchSession";
import { useWorkoutCompletions } from "../hooks/useWorkoutCompletions";
import { fireCelebration } from "../lib/confetti";
import type { Exercise } from "../hooks/useWorkoutPlan";

// Full-screen "doing this on my watch" session. The user runs the workout
// from their Garmin watch; this screen waits for the saved activity to reach
// Garmin Connect, at which point the server has already mapped its sets onto
// today's plan and the summary lights up — no phone taps during the workout.

interface Props {
  planId: string;
  dayKey: string;
  dayLabel: string;
  focus: string;
  exercises: Exercise[];
  onExit: () => void;
  /** Fall back to the guided phone walkthrough (resumes at the first gap). */
  onSwitchToPhone: () => void;
}

export function WatchSession({
  planId,
  dayKey,
  dayLabel,
  focus,
  exercises,
  onExit,
  onSwitchToPhone,
}: Props) {
  const session = useWatchSession(planId, dayKey, true);
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
      ) : session.reconnectRequired ? (
        <ReconnectScreen onExit={onExit} onSwitchToPhone={onSwitchToPhone} />
      ) : (
        <WaitingScreen
          focus={focus}
          exercises={exercises}
          startedAt={session.startedAt}
          lastCheckedAt={session.lastCheckedAt}
          isChecking={session.isChecking}
          hadPollError={session.pollError != null}
          onSwitchToPhone={onSwitchToPhone}
        />
      )}
    </div>
  );
}

/** Re-render every second so the elapsed / "checked Ns ago" labels tick. */
function useNowTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function WaitingScreen({
  focus,
  exercises,
  startedAt,
  lastCheckedAt,
  isChecking,
  hadPollError,
  onSwitchToPhone,
}: {
  focus: string;
  exercises: Exercise[];
  startedAt: number;
  lastCheckedAt: number | null;
  isChecking: boolean;
  hadPollError: boolean;
  onSwitchToPhone: () => void;
}) {
  const now = useNowTick();
  const checkedAgoSeconds =
    lastCheckedAt != null ? Math.max(0, Math.round((now - lastCheckedAt) / 1000)) : null;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 28px 28px",
        textAlign: "center",
        gap: 16,
        overflowY: "auto",
      }}
    >
      <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0, marginTop: 12 }}>
        {/* Pulsing halo around a watch-face stand-in */}
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--accent) 18%, transparent)",
            animation: "watchPulse 2.4s ease-out infinite",
          }}
        />
        <span
          style={{
            position: "absolute",
            inset: 18,
            borderRadius: "50%",
            background: "var(--clay)",
            border: "2px solid var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent)",
          }}
        >
          <Icon name="timer" size={40} />
        </span>
        <style>{`@keyframes watchPulse { 0% { transform: scale(0.7); opacity: 0.8; } 100% { transform: scale(1.25); opacity: 0; } }`}</style>
      </div>

      <div>
        <div className="title-lg">{focus}</div>
        <div className="text-caption" style={{ marginTop: 6 }}>
          Elapsed {formatElapsed(now - startedAt)}
        </div>
      </div>

      <p className="text-body" style={{ maxWidth: 340 }}>
        Run today's workout from your watch — it's on your Garmin calendar.
        When you save it, keep your phone near your watch and we'll catch up
        here automatically.
      </p>

      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        {isChecking
          ? "Checking Garmin…"
          : checkedAgoSeconds != null
            ? `Checked ${checkedAgoSeconds}s ago — checks again about every minute`
            : "Waiting for the first check…"}
      </div>

      {hadPollError && (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--sumi)",
            background: "var(--clay)",
            borderRadius: 10,
            padding: "8px 14px",
          }}
        >
          Garmin didn't answer the last check — still watching.
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 360, textAlign: "left" }}>
        <div className="section-title" style={{ margin: "8px 0" }}>
          Today's session
        </div>
        {exercises.map((ex, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              padding: "7px 2px",
              borderBottom: i < exercises.length - 1 ? "1px solid var(--hair)" : "none",
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--ink)" }}>{ex.name}</span>
            <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
              {ex.type === "cardio" ? `${ex.durationMinutes ?? "—"} min` : `${ex.sets} × ${ex.reps}`}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "auto", width: "100%", maxWidth: 360 }}>
        <Button variant="ghost" className="w-full" onClick={onSwitchToPhone}>
          <Icon name="dumbbell" size={15} />
          Use phone walkthrough instead
        </Button>
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
        Your Garmin session expired, so we can't watch for the workout. Reconnect
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
