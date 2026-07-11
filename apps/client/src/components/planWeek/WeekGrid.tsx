import { useDroppable } from "@dnd-kit/core";
import { useIsDesktop } from "../../hooks/useIsDesktop";
import { Card } from "../Card";
import { Icon, type IconName } from "../Icon";
import type { MealDay, MealSlot } from "../../lib/types";

/** A rendered cell's visual state — the parent maps its own domain (AI /
 * recipe / keep / skip) onto this. */
export interface WeekGridCellView {
  label: string;
  tone: "generate" | "recipe" | "keep" | "skip";
  icon?: IconName;
}

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const TONE_STYLE: Record<
  WeekGridCellView["tone"],
  { background: string; color: string; border: string }
> = {
  generate: { background: "var(--wash-accent)", color: "var(--accent-2)", border: "1px solid transparent" },
  recipe: { background: "var(--wash-accent-strong)", color: "var(--accent-2)", border: "1px solid transparent" },
  keep: { background: "var(--clay)", color: "var(--sumi)", border: "1px solid transparent" },
  skip: { background: "transparent", color: "var(--muted)", border: "1.5px dashed var(--hair)" },
};

interface WeekGridProps {
  days: MealDay["day"][];
  slots: MealSlot[];
  todayDay?: MealDay["day"];
  weekStartDate?: Date;
  /** Days that can't be edited (past days of the current week). */
  disabledDays?: Set<MealDay["day"]>;
  getCell: (day: MealDay["day"], slot: MealSlot) => WeekGridCellView;
  onCellTap: (day: MealDay["day"], slot: MealSlot) => void;
  /** Enable drop targets for the desktop drag-from-tray shortcut. Must be
   * rendered inside a DndContext when true. */
  dndEnabled?: boolean;
  /** A tray recipe is currently being dragged — surfaces every editable cell
   * as a drop zone so it's obvious where a recipe can land. */
  activeDrag?: boolean;
}

/**
 * Controlled week-planning grid: a 7×N desktop table, or stacked day cards
 * on mobile. Pure presentation — the parent owns cell state and interprets
 * taps; this never mutates a plan itself, so it also serves as the schedule
 * -template editor in Settings (2-tone cook/skip mode).
 */
export function WeekGrid({
  days,
  slots,
  todayDay,
  weekStartDate,
  disabledDays,
  getCell,
  onCellTap,
  dndEnabled = false,
  activeDrag = false,
}: WeekGridProps) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <DesktopGrid
        days={days}
        slots={slots}
        todayDay={todayDay}
        weekStartDate={weekStartDate}
        disabledDays={disabledDays}
        getCell={getCell}
        onCellTap={onCellTap}
        dndEnabled={dndEnabled}
        activeDrag={activeDrag}
      />
    );
  }
  return (
    <MobileStack
      days={days}
      slots={slots}
      todayDay={todayDay}
      weekStartDate={weekStartDate}
      disabledDays={disabledDays}
      getCell={getCell}
      onCellTap={onCellTap}
      dndEnabled={dndEnabled}
    />
  );
}

function GridCellButton({
  id,
  cell,
  disabled,
  onTap,
  dndEnabled,
  activeDrag,
}: {
  id: string;
  cell: WeekGridCellView;
  disabled?: boolean;
  onTap: () => void;
  dndEnabled: boolean;
  activeDrag: boolean;
}) {
  // Hooks must run unconditionally, so useDroppable is always called; its
  // `disabled` option (not React conditional rendering) turns it off when
  // dnd isn't in play, which keeps this a single component either way.
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !dndEnabled || disabled });
  const tone = TONE_STYLE[cell.tone];
  const droppableIdle = dndEnabled && !disabled && activeDrag && !isOver;
  return (
    <button
      ref={dndEnabled ? setNodeRef : undefined}
      type="button"
      className="tappable"
      disabled={disabled}
      onClick={onTap}
      style={{
        // Tone lives on the button itself so the drop highlight lands exactly
        // on the meal cell — the droppable node and the visible cell are one.
        ...tone,
        borderRadius: "var(--radius-sm)",
        padding: "10px 8px",
        minHeight: 76,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        textAlign: "center",
        width: "100%",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        // Aligned, inset feedback — no offset outline that would spill over
        // neighbouring cells and read as misaligned.
        boxShadow: isOver ? "inset 0 0 0 2px var(--accent)" : "none",
        outline: droppableIdle
          ? "1.5px dashed color-mix(in srgb, var(--accent) 45%, transparent)"
          : "none",
        outlineOffset: -3,
        transform: isOver ? "scale(1.03)" : "none",
        transition: "box-shadow 120ms ease, transform 120ms ease, outline-color 120ms ease",
      }}
    >
      {cell.icon && <Icon name={cell.icon} size={16} />}
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 500,
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {cell.label}
      </span>
    </button>
  );
}

function DesktopGrid({
  days,
  slots,
  todayDay,
  weekStartDate,
  disabledDays,
  getCell,
  onCellTap,
  dndEnabled,
  activeDrag = false,
}: WeekGridProps & { dndEnabled: boolean }) {
  return (
    <Card style={{ padding: 18 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `92px repeat(${days.length}, minmax(0, 1fr))`,
          gap: 8,
        }}
      >
        <div />
        {days.map((day, i) => {
          const dayDate = weekStartDate ? new Date(weekStartDate) : undefined;
          if (dayDate) dayDate.setDate(dayDate.getDate() + i);
          const isToday = day === todayDay;
          return (
            <div key={`h-${day}`} style={{ textAlign: "center", padding: "0 0 8px" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isToday ? "var(--accent)" : "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {day}
              </div>
              {dayDate && (
                <div
                  style={{
                    fontSize: 13,
                    marginTop: 2,
                    fontWeight: isToday ? 600 : 400,
                    color: isToday ? "var(--ink)" : "var(--muted)",
                  }}
                >
                  {dayDate.getDate()}
                </div>
              )}
            </div>
          );
        })}
        {slots.map((slot) => (
          <FragmentRow key={slot}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--sumi)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                display: "flex",
                alignItems: "center",
              }}
            >
              {SLOT_LABEL[slot]}
            </div>
            {days.map((day) => (
              <GridCellButton
                key={`${day}:${slot}`}
                id={`${day}:${slot}`}
                cell={getCell(day, slot)}
                disabled={disabledDays?.has(day)}
                onTap={() => onCellTap(day, slot)}
                dndEnabled={dndEnabled}
                activeDrag={activeDrag}
              />
            ))}
          </FragmentRow>
        ))}
      </div>
    </Card>
  );
}

// A plain wrapper so each slot row's children (label + N day cells) land as
// direct grid items without an extra DOM element breaking the column track.
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MobileStack({
  days,
  slots,
  todayDay,
  weekStartDate,
  disabledDays,
  getCell,
  onCellTap,
}: WeekGridProps & { dndEnabled: boolean }) {
  return (
    <div className="stagger-in" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {days.map((day, i) => {
        const dayDate = weekStartDate ? new Date(weekStartDate) : undefined;
        if (dayDate) dayDate.setDate(dayDate.getDate() + i);
        const disabled = disabledDays?.has(day);
        return (
          <Card key={day} raised={day === todayDay} style={{ opacity: disabled ? 0.5 : 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <div className="eyebrow" style={{ color: day === todayDay ? "var(--accent)" : undefined }}>
                {day}
                {dayDate && (
                  <span style={{ marginLeft: 6, color: "var(--muted)", fontWeight: 400 }}>
                    {dayDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {slots.map((slot) => {
                const cell = getCell(day, slot);
                const style = TONE_STYLE[cell.tone];
                return (
                  <button
                    key={slot}
                    type="button"
                    className="tappable"
                    disabled={disabled}
                    onClick={() => onCellTap(day, slot)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "var(--radius-sm)",
                      cursor: disabled ? "not-allowed" : "pointer",
                      textAlign: "left",
                      ...style,
                    }}
                  >
                    {cell.icon && <Icon name={cell.icon} size={15} />}
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", width: 66, flexShrink: 0 }}>
                      {SLOT_LABEL[slot]}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cell.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
