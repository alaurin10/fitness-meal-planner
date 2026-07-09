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
}: WeekGridProps) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <DesktopGrid
        days={days}
        slots={slots}
        todayDay={todayDay}
        disabledDays={disabledDays}
        getCell={getCell}
        onCellTap={onCellTap}
        dndEnabled={dndEnabled}
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

function CellContent({ cell }: { cell: WeekGridCellView }) {
  const style = TONE_STYLE[cell.tone];
  return (
    <div
      style={{
        ...style,
        borderRadius: "var(--radius-sm)",
        padding: "8px 6px",
        minHeight: 58,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        textAlign: "center",
        width: "100%",
        height: "100%",
      }}
    >
      {cell.icon && <Icon name={cell.icon} size={14} />}
      <span
        style={{
          fontSize: 10.5,
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
    </div>
  );
}

function GridCellButton({
  id,
  cell,
  disabled,
  onTap,
  dndEnabled,
}: {
  id: string;
  cell: WeekGridCellView;
  disabled?: boolean;
  onTap: () => void;
  dndEnabled: boolean;
}) {
  // Hooks must run unconditionally, so useDroppable is always called; its
  // `disabled` option (not React conditional rendering) turns it off when
  // dnd isn't in play, which keeps this a single component either way.
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !dndEnabled || disabled });
  return (
    <button
      ref={dndEnabled ? setNodeRef : undefined}
      type="button"
      className="tappable"
      disabled={disabled}
      onClick={onTap}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        opacity: disabled ? 0.4 : 1,
        width: "100%",
        cursor: disabled ? "not-allowed" : "pointer",
        outline: isOver ? "2px solid var(--accent)" : "none",
        outlineOffset: 2,
        borderRadius: "var(--radius-sm)",
      }}
    >
      <CellContent cell={cell} />
    </button>
  );
}

function DesktopGrid({
  days,
  slots,
  todayDay,
  disabledDays,
  getCell,
  onCellTap,
  dndEnabled,
}: Omit<WeekGridProps, "weekStartDate"> & { dndEnabled: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `76px repeat(${days.length}, minmax(0, 1fr))`,
        gap: 6,
      }}
    >
      <div />
      {days.map((day) => (
        <div
          key={`h-${day}`}
          style={{
            textAlign: "center",
            fontSize: 11,
            fontWeight: 600,
            color: day === todayDay ? "var(--accent)" : "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            padding: "4px 0",
          }}
        >
          {day}
        </div>
      ))}
      {slots.map((slot) => (
        <FragmentRow key={slot}>
          <div
            style={{
              fontSize: 11,
              color: "var(--muted)",
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
            />
          ))}
        </FragmentRow>
      ))}
    </div>
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
