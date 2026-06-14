import { useMemo, type CSSProperties, type ReactNode } from "react";
import { rotateDays, type DayLabel, type WeekStartDay } from "@platform/shared";
import { Card } from "../../components/Card";
import { Icon, type IconName } from "../../components/Icon";
import { Chip } from "../../components/Primitives";
import type { EquipmentId, ProfileInput } from "../../hooks/useProfile";
import {
  cmToInches,
  inchesToCm,
  kgToPounds,
  poundsToKg,
  roundTo,
} from "../../lib/units";
import { EQUIPMENT, EXPERIENCE, GOALS, QUICK_NOTES } from "./constants";
import { toFeetInches, toInches } from "./helpers";

export const twoColGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

export const sectionLabelStyle: CSSProperties = {
  fontSize: 12.5,
  color: "var(--sumi)",
  marginBottom: 8,
};

export const unitStyle: CSSProperties = {
  position: "absolute",
  right: 14,
  top: "50%",
  transform: "translateY(-50%)",
  fontSize: 12,
  color: "var(--muted)",
  letterSpacing: "0.03em",
};

export function SummaryRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "10px 0",
        borderBottom: last ? "none" : "1px solid var(--hair)",
      }}
    >
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{label}</span>
      <span
        style={{
          fontSize: 14,
          color: "var(--ink)",
          fontWeight: 500,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function TargetSummaryCard({
  title,
  unit,
  value,
  isSuggested,
}: {
  title: string;
  unit: string;
  value: number | null;
  isSuggested: boolean;
}) {
  return (
    <Card tone={isSuggested ? "gradient" : "paper"}>
      <div className="flex items-start justify-between gap-3">
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {title}
          </div>
          <div
            className="font-display"
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              marginTop: 8,
              color: "var(--ink)",
            }}
          >
            <span style={{ fontSize: value == null ? 22 : 32 }}>
              {value ?? "Not set"}
            </span>
            {value != null && (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{unit}</span>
            )}
          </div>
        </div>
        <span
          style={{
            border: "1px solid var(--hair)",
            background: isSuggested ? "var(--paper)" : "var(--ink)",
            color: isSuggested ? "var(--sumi)" : "var(--paper)",
            borderRadius: 999,
            padding: "6px 10px",
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: "nowrap",
            letterSpacing: "0.04em",
          }}
        >
          {isSuggested ? "Suggested" : "Custom"}
        </span>
      </div>
    </Card>
  );
}

export function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div style={sectionLabelStyle}>{label}</div>
      {children}
    </div>
  );
}

export function ChoiceButton({
  active,
  children,
  compact = false,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tappable"
      style={{
        padding: compact ? "10px 10px" : "12px 12px",
        border: "1px solid " + (active ? "var(--ink)" : "var(--hair)"),
        background: active ? "var(--ink)" : "var(--paper)",
        color: active ? "var(--paper)" : "var(--sumi)",
        borderRadius: "calc(var(--radius) * 0.6)",
        fontFamily: "var(--font-body)",
        fontSize: compact ? 12 : 13,
        fontWeight: 500,
        textTransform: "capitalize",
      }}
    >
      {children}
    </button>
  );
}

export function NumberField({
  label,
  unit,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  unit: string;
  value: number | "";
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <FieldBlock label={label}>
      <div style={{ position: "relative" }}>
        <input
          type="number"
          inputMode="decimal"
          className="field-input"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          style={{ paddingRight: 44 }}
        />
        <span style={unitStyle}>{unit}</span>
      </div>
    </FieldBlock>
  );
}

export function ImperialHeightField({
  feet,
  inches,
  onFeetChange,
  onInchesChange,
}: {
  feet: number | null;
  inches: number | null;
  onFeetChange: (value: number | null) => void;
  onInchesChange: (value: number | null) => void;
}) {
  return (
    <FieldBlock label="Height">
      <div style={twoColGrid}>
        <div style={{ position: "relative" }}>
          <input
            type="number"
            inputMode="numeric"
            className="field-input"
            value={feet ?? ""}
            min={3}
            max={8}
            onChange={(e) => onFeetChange(e.target.value === "" ? null : Number(e.target.value))}
            style={{ paddingRight: 34 }}
          />
          <span style={unitStyle}>ft</span>
        </div>
        <div style={{ position: "relative" }}>
          <input
            type="number"
            inputMode="numeric"
            className="field-input"
            value={inches ?? ""}
            min={0}
            max={11}
            onChange={(e) =>
              onInchesChange(
                e.target.value === ""
                  ? null
                  : Math.max(0, Math.min(11, Number(e.target.value))),
              )
            }
            style={{ paddingRight: 34 }}
          />
          <span style={unitStyle}>in</span>
        </div>
      </div>
    </FieldBlock>
  );
}

export function TargetCard({
  title,
  unit,
  helper,
  value,
  suggestedValue,
  useSuggested,
  onToggle,
  onChange,
  min,
  max,
}: {
  title: string;
  unit: string;
  helper: string;
  value: number | "";
  suggestedValue: number | null;
  useSuggested: boolean;
  onToggle: () => void;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
}) {
  return (
    <Card tone={useSuggested ? "gradient" : "paper"}>
      <div className="flex items-start justify-between gap-3">
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {title}
          </div>
          {useSuggested ? (
            <>
              <div
                className="font-display"
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  marginTop: 8,
                  color: "var(--ink)",
                }}
              >
                <span style={{ fontSize: suggestedValue == null ? 24 : 32 }}>
                  {suggestedValue ?? "Waiting on your stats"}
                </span>
                {suggestedValue != null && (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{unit}</span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--sumi)", marginTop: 6 }}>
                {suggestedValue == null
                  ? "Add age, sex, weight, and height for a tailored estimate."
                  : helper}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--sumi)", marginTop: 8 }}>
              Override the estimate if you already have a goal from a coach or tracker.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="tappable"
          style={{
            border: "1px solid var(--hair)",
            background: useSuggested ? "var(--paper)" : "var(--ink)",
            color: useSuggested ? "var(--sumi)" : "var(--paper)",
            borderRadius: 999,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {useSuggested ? "Customize" : "Use suggestion"}
        </button>
      </div>

      {!useSuggested && (
        <div style={{ marginTop: 14 }}>
          <div style={{ position: "relative" }}>
            <input
              type="number"
              min={min}
              max={max}
              className="field-input font-display"
              value={value}
              onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
              placeholder={suggestedValue == null ? "" : String(suggestedValue)}
              style={{ fontSize: 24, paddingRight: 54 }}
            />
            <span style={unitStyle}>{unit}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
            {suggestedValue == null
              ? "We can suggest this once the core stats above are filled in."
              : `Suggested: ${suggestedValue} ${unit}`}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Shared field groups ─────────────────────────────────────────
   Used by both the first-run SetupForm and the per-section edit
   sheets so the two surfaces can't drift apart. Each operates on a
   slice of ProfileInput via value/onChange. */

export type NumbersValue = Pick<
  ProfileInput,
  "unitSystem" | "age" | "sex" | "weightLbs" | "heightIn"
>;

export function NumbersFields({
  value,
  onChange,
}: {
  value: NumbersValue;
  onChange: (patch: Partial<NumbersValue>) => void;
}) {
  const { feet: heightFeet, inches: heightInches } = useMemo(
    () => toFeetInches(value.heightIn),
    [value.heightIn],
  );
  const displayWeight =
    value.weightLbs == null
      ? ""
      : value.unitSystem === "metric"
        ? roundTo(poundsToKg(value.weightLbs), 1)
        : roundTo(value.weightLbs, 1);
  const displayHeightCm = value.heightIn == null ? "" : roundTo(inchesToCm(value.heightIn), 1);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={twoColGrid}>
        <NumberField
          label="Age"
          unit="yrs"
          value={value.age ?? ""}
          onChange={(age) => onChange({ age })}
          min={10}
          max={100}
        />
        <FieldBlock label="Sex">
          <div style={twoColGrid}>
            {(["male", "female"] as const).map((sex) => (
              <ChoiceButton
                key={sex}
                active={value.sex === sex}
                onClick={() => onChange({ sex })}
                compact
              >
                {sex}
              </ChoiceButton>
            ))}
          </div>
        </FieldBlock>
      </div>

      <div style={twoColGrid}>
        <NumberField
          label="Weight"
          unit={value.unitSystem === "metric" ? "kg" : "lb"}
          value={displayWeight}
          onChange={(weight) =>
            onChange({
              weightLbs:
                weight == null
                  ? null
                  : value.unitSystem === "metric"
                    ? roundTo(kgToPounds(weight), 2)
                    : weight,
            })
          }
          step={value.unitSystem === "metric" ? 0.1 : 1}
          min={value.unitSystem === "metric" ? 30 : 65}
        />
        {value.unitSystem === "metric" ? (
          <NumberField
            label="Height"
            unit="cm"
            value={displayHeightCm}
            onChange={(cm) =>
              onChange({ heightIn: cm == null ? null : roundTo(cmToInches(cm), 2) })
            }
            step={0.1}
            min={120}
          />
        ) : (
          <ImperialHeightField
            feet={heightFeet}
            inches={heightInches}
            onFeetChange={(feet) =>
              onChange({
                heightIn:
                  feet == null && heightInches == null ? null : toInches(feet, heightInches),
              })
            }
            onInchesChange={(inches) =>
              onChange({
                heightIn:
                  heightFeet == null && inches == null ? null : toInches(heightFeet, inches),
              })
            }
          />
        )}
      </div>
    </div>
  );
}

export function ExperiencePicker({
  value,
  onChange,
}: {
  value: ProfileInput["experienceLevel"];
  onChange: (value: ProfileInput["experienceLevel"]) => void;
}) {
  return (
    <div>
      <div style={sectionLabelStyle}>Experience</div>
      <div style={{ ...twoColGrid, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {EXPERIENCE.map(([level, label]) => (
          <ChoiceButton
            key={level}
            active={value === level}
            onClick={() => onChange(level)}
            compact
          >
            {label}
          </ChoiceButton>
        ))}
      </div>
    </div>
  );
}

export function TrainingDaysPicker({
  days,
  daysPerWeek,
  weekStartDay,
  onChange,
}: {
  days: DayLabel[];
  daysPerWeek: number;
  weekStartDay: WeekStartDay;
  onChange: (days: DayLabel[]) => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
          alignItems: "center",
        }}
      >
        <span style={sectionLabelStyle}>Training days</span>
        <span className="font-display" style={{ fontSize: 18, color: "var(--accent)" }}>
          {(days.length || daysPerWeek)} days
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {rotateDays(weekStartDay).map((d) => {
          const selected = days.includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onChange(selected ? days.filter((x) => x !== d) : [...days, d])}
              className="tappable"
              style={{
                minWidth: 44,
                padding: "10px 0",
                border: "1px solid " + (selected ? "var(--accent)" : "var(--hair)"),
                background: selected
                  ? "color-mix(in srgb, var(--accent) 18%, transparent)"
                  : "var(--paper)",
                color: selected ? "var(--accent-2)" : "var(--sumi)",
                borderRadius: "calc(var(--radius) * 0.55)",
                fontFamily: "var(--font-display)",
                fontSize: 13,
                flex: 1,
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Shared icon-tile selector used for goal, meal style, and workout style. */
export function IconChoiceGrid<T extends string>({
  label,
  options,
  value,
  onChange,
  columns,
  hint,
}: {
  label?: string;
  options: ReadonlyArray<{ value: T; label: string; icon: IconName }>;
  value: T;
  onChange: (value: T) => void;
  columns: number;
  hint?: ReactNode;
}) {
  return (
    <div>
      {label && <div style={sectionLabelStyle}>{label}</div>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 8,
        }}
      >
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="tappable"
              style={{
                padding: "14px 10px 12px",
                border: "1px solid " + (selected ? "var(--accent)" : "var(--hair)"),
                background: selected
                  ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                  : "var(--paper)",
                color: selected ? "var(--accent-2)" : "var(--sumi)",
                borderRadius: "calc(var(--radius) * 0.7)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-body)",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <Icon name={opt.icon} size={18} />
              {opt.label}
            </button>
          );
        })}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function GoalPicker({
  value,
  onChange,
}: {
  value: ProfileInput["goal"];
  onChange: (value: ProfileInput["goal"]) => void;
}) {
  return (
    <IconChoiceGrid
      label="Goal"
      options={GOALS.map(([v, label, icon]) => ({ value: v, label, icon }))}
      value={value}
      onChange={onChange}
      columns={3}
    />
  );
}

export function EquipmentPicker({
  value,
  onChange,
}: {
  value: EquipmentId[];
  onChange: (value: EquipmentId[]) => void;
}) {
  return (
    <div>
      <div style={{ ...sectionLabelStyle, marginBottom: 8 }}>What can you train with?</div>
      <div className="flex flex-wrap gap-1.5">
        {EQUIPMENT.map((opt) => {
          const active = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                onChange(
                  active ? value.filter((e) => e !== opt.value) : [...value, opt.value],
                )
              }
              className="tappable"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              <Chip variant={active ? "moss" : "ghost"}>
                {active ? "✓ " : ""}
                {opt.label}
              </Chip>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>
        {value.length === 0
          ? "Nothing selected — plans will be bodyweight only."
          : "Workouts will only use the equipment you've selected."}
      </div>
    </div>
  );
}

export function HydrationControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const stepperButton: CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "1px solid var(--hair)",
    background: "var(--paper)",
    color: "var(--ink)",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  return (
    <div className="flex items-center justify-between">
      <div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Hydration
        </div>
        <div style={{ fontSize: 12, color: "var(--sumi)", marginTop: 4, lineHeight: 1.4 }}>
          Cups or drinks per day.
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          className="tappable"
          onClick={() => onChange(Math.max(1, value - 1))}
          style={stepperButton}
          aria-label="Decrease goal"
        >
          &minus;
        </button>
        <span
          className="font-display"
          style={{ fontSize: 24, color: "var(--ink)", minWidth: 28, textAlign: "center" }}
        >
          {value}
        </span>
        <button
          type="button"
          className="tappable"
          onClick={() => onChange(Math.min(20, value + 1))}
          style={stepperButton}
          aria-label="Increase goal"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function DietaryNotesField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const addQuick = (note: string) => {
    const current = value ?? "";
    if (current.toLowerCase().includes(note.toLowerCase())) return;
    onChange(current ? `${current}, ${note}` : note);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {QUICK_NOTES.map((note) => {
          const active = (value ?? "").toLowerCase().includes(note.toLowerCase());
          return (
            <button
              key={note}
              type="button"
              onClick={() => addQuick(note)}
              className="tappable"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              disabled={active}
            >
              <Chip variant={active ? "moss" : "ghost"}>{note}</Chip>
            </button>
          );
        })}
      </div>
      <textarea
        rows={3}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        placeholder="e.g. no dairy, low FODMAP, vegetarian"
        className="field-input"
        style={{
          resize: "vertical",
          minHeight: 80,
          // Inherit the 16px from .field-input — a smaller size makes iOS
          // Safari auto-zoom the page when the textarea is focused.
          lineHeight: 1.5,
        }}
      />
    </div>
  );
}
