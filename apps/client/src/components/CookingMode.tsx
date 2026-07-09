import { useEffect, useRef, useState } from "react";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useCookingSession } from "../hooks/useCookingSession";
import { useSwipe } from "../hooks/useSwipe";
import { useWakeLock } from "../hooks/useWakeLock";
import { success, tap } from "../lib/haptics";
import { formatMinutes, formatQuantity, type UnitSystem } from "../lib/units";
import type { Ingredient, Meal, RecipeStep } from "../lib/types";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Chip } from "./Primitives";

/**
 * Guided step-by-step cooking walkthrough. Mirrors WorkoutMode's immersive
 * dark canvas: wall-clock timers that survive backgrounding, a wake lock so
 * the screen doesn't dim mid-recipe, swipe navigation, an overview jump
 * sheet, and localStorage resume so a backgrounded/closed tab picks back up.
 */
export function CookingMode({
  meal,
  unitSystem,
  scale,
  sessionKey,
  onExit,
  onComplete,
}: {
  meal: Meal;
  unitSystem: UnitSystem;
  scale: number;
  /** Identifies this meal across sessions so progress can resume. */
  sessionKey: string;
  onExit: () => void;
  /**
   * Called once when the user finishes the last step (taps "Done").
   * Lets the host mark the meal complete automatically.
   */
  onComplete?: () => void;
}) {
  const { session, saveSession, clearSession } = useCookingSession(sessionKey);
  const [stepIdx, setStepIdx] = useState(() =>
    session ? Math.min(session.stepIdx, Math.max(0, meal.steps.length - 1)) : 0,
  );
  const [resumeBannerDismissed, setResumeBannerDismissed] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const total = meal.steps.length;
  const step = meal.steps[stepIdx];
  const completionFiredRef = useRef(false);

  useWakeLock(true);

  useEffect(() => {
    if (stepIdx < total - 1 || total === 0) {
      saveSession(stepIdx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  function finish() {
    if (!completionFiredRef.current) {
      completionFiredRef.current = true;
      success();
      onComplete?.();
    }
    clearSession();
    onExit();
  }

  function goNext() {
    if (stepIdx >= total - 1) {
      finish();
      return;
    }
    tap();
    setStepIdx((i) => Math.min(total - 1, i + 1));
  }

  function goBack() {
    if (stepIdx === 0) return;
    tap();
    setStepIdx((i) => Math.max(0, i - 1));
  }

  function jumpTo(idx: number) {
    setStepIdx(idx);
    setOverviewOpen(false);
  }

  const swipe = useSwipe({ onSwipeLeft: goNext, onSwipeRight: goBack });

  if (!step) return null;

  const showResumeBanner =
    !resumeBannerDismissed && session !== null && session.stepIdx > 0 && stepIdx === session.stepIdx;

  return (
    // Same full-screen theme-following takeover as WorkoutMode.
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
        <button
          type="button"
          onClick={() => setOverviewOpen(true)}
          aria-label="Recipe overview"
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
          <div className="eyebrow">{meal.name}</div>
          <Icon name="list" size={14} style={{ color: "var(--muted)" }} />
        </button>
        <button
          type="button"
          onClick={() => {
            saveSession(stepIdx);
            onExit();
          }}
          aria-label="Exit cooking mode"
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

      {showResumeBanner && (
        <div className="px-5">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 10,
              background: "color-mix(in srgb, var(--accent) 10%, transparent)",
              fontSize: 12,
              color: "var(--sumi)",
            }}
          >
            <span>Resumed at step {stepIdx + 1}.</span>
            <button
              type="button"
              onClick={() => {
                setResumeBannerDismissed(true);
                setStepIdx(0);
              }}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--accent-2)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Start over
            </button>
          </div>
        </div>
      )}

      <div className="px-5">
        <div className="prog">
          <span style={{ width: `${((stepIdx + 1) / total) * 100}%` }} />
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--muted)",
            marginTop: 6,
            letterSpacing: "0.08em",
          }}
        >
          STEP {stepIdx + 1} OF {total}
        </div>
      </div>

      <div
        {...swipe}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "24px 28px",
          textAlign: "center",
          gap: 18,
          touchAction: "pan-y",
        }}
      >
        <div
          className="font-display"
          style={{
            fontSize: 26,
            color: "var(--ink)",
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
            maxWidth: 360,
          }}
        >
          {step.text}
        </div>
        {shouldShowTimer(step.text, step.durationMinutes) ? (
          <StepTimer key={step.order} minutes={step.durationMinutes!} />
        ) : null}
        <RelevantIngredients
          step={step.text}
          ingredients={meal.ingredients}
          unitSystem={unitSystem}
          scale={scale}
        />
        <UpcomingSteps steps={meal.steps} currentIdx={stepIdx} />
      </div>

      <div
        style={{
          padding: "16px 20px 28px",
          display: "flex",
          gap: 10,
        }}
      >
        <Button
          size="lg"
          variant="ghost"
          onClick={goBack}
          disabled={stepIdx === 0}
          style={{ flex: 1 }}
        >
          <Icon name="chevron" size={14} style={{ transform: "rotate(180deg)" }} />
          Back
        </Button>
        <Button size="lg" variant="accent" onClick={goNext} style={{ flex: 2 }}>
          {stepIdx < total - 1 ? (
            <>
              Next
              <Icon name="chevron" size={16} />
            </>
          ) : (
            <>
              <Icon name="check" size={16} />
              Done
            </>
          )}
        </Button>
      </div>

      {overviewOpen && (
        <OverviewSheet
          steps={meal.steps}
          currentIdx={stepIdx}
          onJump={jumpTo}
          onClose={() => setOverviewOpen(false)}
        />
      )}
    </div>
  );
}

function OverviewSheet({
  steps,
  currentIdx,
  onJump,
  onClose,
}: {
  steps: RecipeStep[];
  currentIdx: number;
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
      aria-label="Recipe overview"
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
            Recipe overview
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
          {steps.map((s, i) => {
            const isDone = i < currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <button
                key={s.order}
                type="button"
                ref={isCurrent ? currentRef : undefined}
                onClick={() => onJump(i)}
                aria-current={isCurrent ? "true" : undefined}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "13px 12px",
                  background: isCurrent
                    ? "color-mix(in srgb, var(--accent) 7%, transparent)"
                    : "transparent",
                  border: "none",
                  borderBottom: i < steps.length - 1 ? "1px solid var(--hair)" : "none",
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
                  <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.4 }}>{s.text}</div>
                  {s.durationMinutes ? (
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
                      {formatMinutes(s.durationMinutes)}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Wall-clock-anchored countdown: the deadline is a fixed timestamp rather
 * than a per-tick decrement, so mobile browsers throttling setInterval in a
 * backgrounded tab don't cause drift — the remaining time is recomputed from
 * Date.now() the moment the page is foregrounded again.
 */
function StepTimer({ minutes }: { minutes: number }) {
  const totalSeconds = minutes * 60;
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
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

  const running = deadline !== null && remaining > 0;
  const done = deadline !== null && remaining === 0;
  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "16px 24px",
        background: "var(--paper)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--hair)",
      }}
    >
      <div
        className="font-display"
        style={{
          fontSize: 36,
          color: done ? "var(--accent)" : "var(--ink)",
          letterSpacing: "0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {mm}:{ss}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          variant="ghost"
          onClick={() => (running ? setDeadline(null) : setDeadline(Date.now() + remaining * 1000))}
          disabled={done}
        >
          {running ? "Pause" : remaining === totalSeconds ? "Start" : "Resume"}
        </Button>
        <Button
          variant="plain"
          onClick={() => {
            setDeadline(null);
            setRemaining(totalSeconds);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

/**
 * Show a timer only for steps that involve actual cooking/waiting time
 * (bake, simmer, rest, marinate, etc.) — not for short prep estimates
 * like "chop the onions for 1 minute."
 */
const COOKING_KEYWORDS = [
  "bake", "boil", "simmer", "cook", "fry", "sear", "roast",
  "rest", "marinate", "chill", "rise", "steep", "broil",
  "grill", "refrigerate", "freeze", "sauté", "sautee", "saute",
  "brown", "reduce", "poach", "blanch", "toast", "roasting",
  "baking", "boiling", "simmering", "frying", "searing",
  "resting", "marinating", "chilling", "rising", "steeping",
  "broiling", "grilling", "browning", "reducing", "poaching",
  "blanching", "toasting", "set aside", "let stand", "let sit",
  "until golden", "until tender", "until cooked", "until done",
  "for at least", "preheat",
];

function shouldShowTimer(stepText: string, minutes?: number): boolean {
  if (!minutes || minutes < 1) return false;
  // Always offer a timer for longer waits — those are clearly cooking durations.
  if (minutes >= 5) return true;
  const lower = stepText.toLowerCase();
  return COOKING_KEYWORDS.some((kw) => lower.includes(kw));
}

function UpcomingSteps({
  steps,
  currentIdx,
}: {
  steps: { order: number; text: string }[];
  currentIdx: number;
}) {
  const next = steps.slice(currentIdx + 1, currentIdx + 3);
  if (next.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 8,
        width: "100%",
        maxWidth: 420,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "stretch",
      }}
    >
      <div className="eyebrow" style={{ textAlign: "left", paddingLeft: 4, opacity: 0.7 }}>
        Coming up
      </div>
      {next.map((s, i) => (
        <div
          key={s.order}
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            padding: "10px 12px",
            background: "var(--paper)",
            border: "1px solid var(--hair)",
            borderRadius: 12,
            opacity: i === 0 ? 0.85 : 0.6,
            textAlign: "left",
          }}
        >
          <span
            className="font-display"
            style={{
              fontSize: 12,
              color: "var(--muted)",
              lineHeight: 1.6,
              flexShrink: 0,
              minWidth: 18,
            }}
          >
            {s.order}
          </span>
          <span style={{ fontSize: 13, color: "var(--sumi)", lineHeight: 1.45, flex: 1 }}>{s.text}</span>
        </div>
      ))}
    </div>
  );
}

function RelevantIngredients({
  step,
  ingredients,
  unitSystem,
  scale,
}: {
  step: string;
  ingredients: Ingredient[];
  unitSystem: UnitSystem;
  scale: number;
}) {
  const stepLower = step.toLowerCase();
  const matches = ingredients.filter((i) => stepLower.includes(i.name.toLowerCase()));
  if (matches.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        justifyContent: "center",
        maxWidth: 360,
      }}
    >
      {matches.map((m, i) => (
        <Chip key={i} variant="ghost">
          {formatQuantity(m.quantity, unitSystem, scale)} {m.name}
        </Chip>
      ))}
    </div>
  );
}
