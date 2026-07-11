// Dev-only design-system preview (served by `vite dev` at /preview.html).
// Renders the redesigned primitives without Clerk/API so the four
// palette×theme combos can be screenshotted. Not part of the app build.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import "./index.css";
import { AddMealSheet } from "./components/AddMealSheet";
import { BottomNav } from "./components/BottomNav";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { ChartTooltip } from "./components/ChartTooltip";
import { CircleButton } from "./components/CircleButton";
import { EmptyState } from "./components/EmptyState";
import { Heatmap } from "./components/Heatmap";
import { Icon } from "./components/Icon";
import { Illustration } from "./components/Illustration";
import { LeftoverRepairDialog } from "./components/LeftoverRepairDialog";
import { CellActionSheet } from "./components/planWeek/CellActionSheet";
import { WeekGrid, type WeekGridCellView } from "./components/planWeek/WeekGrid";
import { ProgressRing } from "./components/ProgressRing";
import { Chip, PageHero, Ring, TimeSparkline } from "./components/Primitives";
import type { MealDay, MealSlot } from "./lib/types";
import { WeeklyBars } from "./components/WeeklyBars";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

const sparkData = [182, 181.4, 181.8, 180.9, 180.2, 180.5, 179.8, 179.2].map(
  (v, i) => ({ date: daysAgo(7 - i), value: v }),
);

const barDays = ["M", "T", "W", "T", "F", "S", "S"].map((label, i) => ({
  label,
  isToday: i === 3,
  isFuture: i > 3,
  values: [
    { color: "var(--moss)", fraction: 0.4 + 0.1 * i },
    { color: "var(--accent)", fraction: 0.9 - 0.08 * i },
    { color: "var(--honey)", fraction: 0.55 },
  ],
}));

const heatData = Array.from({ length: 60 }, (_, i) => {
  const d = daysAgo(i);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { date: key, level: ((i * 7) % 4) as 0 | 1 | 2 | 3 };
});

const WEEK_GRID_DAYS: MealDay["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEK_GRID_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const WEEK_GRID_DEMO: Partial<Record<string, WeekGridCellView>> = {
  "Mon:breakfast": { label: "Generate", tone: "generate", icon: "sparkle" },
  "Mon:lunch": { label: "Yogurt bowl", tone: "keep", icon: "check" },
  "Mon:dinner": { label: "Miso salmon", tone: "recipe", icon: "fork" },
  "Mon:snack": { label: "Generate", tone: "generate", icon: "sparkle" },
  "Tue:breakfast": { label: "Generate", tone: "generate", icon: "sparkle" },
  "Tue:lunch": { label: "Skipped", tone: "skip", icon: "x" },
  "Tue:dinner": { label: "Skipped", tone: "skip", icon: "x" },
  "Tue:snack": { label: "Skipped", tone: "skip", icon: "x" },
};

function DemoDraggable({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe:${id}`,
    data: { recipe: { id, name: label } },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.35 : 1, cursor: "grab", touchAction: "none" }}
    >
      <div className="chip" style={{ width: "100%", justifyContent: "flex-start" }}>
        <Icon name="fork" size={12} /> {label}
      </div>
    </div>
  );
}

/** Mirrors PlanWeek's desktop drag-and-drop wiring so the grid layout and
 * drop-target alignment can be screenshotted and drag-tested in isolation. */
function PlanWeekDesktopDemo() {
  const [cells, setCells] = useState<Record<string, WeekGridCellView>>({
    "Tue:lunch": { label: "Skipped", tone: "skip", icon: "x" },
    "Wed:dinner": { label: "Miso salmon", tone: "recipe", icon: "fork" },
    "Thu:breakfast": { label: "Yogurt bowl", tone: "keep", icon: "check" },
  });
  const [drag, setDrag] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const getCell = (day: MealDay["day"], slot: MealSlot): WeekGridCellView =>
    cells[`${day}:${slot}`] ?? { label: "Generate", tone: "generate", icon: "sparkle" };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={(e) => setDrag((e.active.data.current?.recipe as { name: string })?.name ?? null)}
      onDragEnd={(e) => {
        setDrag(null);
        const over = e.over?.id;
        const name = (e.active.data.current?.recipe as { name: string })?.name;
        if (typeof over === "string" && name) {
          setCells((c) => ({ ...c, [over]: { label: name, tone: "recipe", icon: "fork" } }));
        }
      }}
      onDragCancel={() => setDrag(null)}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 24, alignItems: "start" }}>
        <WeekGrid
          days={WEEK_GRID_DAYS}
          slots={WEEK_GRID_SLOTS}
          todayDay="Wed"
          weekStartDate={new Date(2026, 6, 6)}
          getCell={getCell}
          onCellTap={() => {}}
          dndEnabled
          activeDrag={drag !== null}
        />
        <Card style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Recipe book</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {["Miso salmon", "Chicken tikka", "Greek yogurt bowl", "Protein smoothie", "Overnight oats"].map(
              (r, i) => <DemoDraggable key={i} id={String(i)} label={r} />,
            )}
          </div>
        </Card>
      </div>
      <DragOverlay dropAnimation={null}>
        {drag && (
          <div
            className="chip"
            style={{ background: "var(--accent)", color: "var(--on-accent)", boxShadow: "var(--shadow-lg)" }}
          >
            <Icon name="fork" size={12} /> {drag}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Preview() {
  const [cellSheetOpen, setCellSheetOpen] = useState(false);
  const [leftoverOpen, setLeftoverOpen] = useState(false);
  const [addMealOpen, setAddMealOpen] = useState(false);

  return (
    <>
      <div aria-hidden className="ambient-bg" />
      {/* Mirrors the Layout shell: flex column at min-h-dvh so the in-flow
          sticky BottomNav pins to the viewport bottom here too. */}
      <div className="mx-auto max-w-[480px] min-h-dvh relative flex flex-col">
        <main className="relative flex-1 w-full overflow-x-clip pb-4">
          {/* Regression check: a long title next to a button cluster (as on
              Workouts/Meals) must ellipsize on narrow phones, never overlap
              the buttons. */}
          <PageHero
            title="Workouts"
            right={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CircleButton aria-label="Info"><Icon name="note" size={18} /></CircleButton>
                <CircleButton aria-label="Plan"><Icon name="plan" size={18} /></CircleButton>
                <Chip>This week</Chip>
              </div>
            }
          />
          <PageHero
            eyebrow="Thursday, July 3"
            title="Good morning."
            below={
              <span className="chip chip-honey" style={{ marginTop: 10, fontWeight: 600 }}>
                <Icon name="flame" size={14} /> 12 day streak
              </span>
            }
          />

          <div className="px-4 flex flex-col gap-3 stagger-in">
            <Card tone="glass" className="texture-grain">
              <div className="eyebrow" style={{ marginBottom: 14 }}>Today's progress</div>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <Ring value={0.68} size={108} stroke={10} gradient>
                  <span className="display-stat" style={{ fontSize: 27 }}>
                    68<span style={{ fontSize: 14, fontWeight: 400 }}>%</span>
                  </span>
                </Ring>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
                  {[
                    ["Workout", "3/6", "var(--moss)", 0.5],
                    ["Calories", "1,430 / 2,200", "var(--accent)", 0.65],
                    ["Protein", "96 / 160g", "var(--honey)", 0.6],
                    ["Water", "5 / 8", "var(--accent)", 0.62],
                  ].map(([label, value, color, frac]) => (
                    <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          width: 13,
                          height: 13,
                          borderRadius: "50%",
                          flexShrink: 0,
                          background: `conic-gradient(${color} ${Math.round((frac as number) * 360)}deg, color-mix(in srgb, var(--muted) 20%, transparent) 0deg)`,
                        }}
                      />
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink)", letterSpacing: "0.05em", textTransform: "uppercase", flex: 1 }}>
                        {label}
                      </span>
                      <span className="font-display" style={{ fontSize: 13.5, color: "var(--sumi)" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card tone="accent" raised>
              <div className="eyebrow">Today's workout</div>
              <div className="title-lg" style={{ marginTop: 4 }}>Upper push</div>
              <div className="flex gap-2 mt-3">
                <Chip>6 exercises</Chip>
                <Chip>Session</Chip>
                <Chip>45 min</Chip>
              </div>
              <Button className="w-full mt-4" size="lg">
                Start workout <Icon name="chevron" size={16} />
              </Button>
            </Card>

            <Card tone="hero" raised>
              <div className="eyebrow">Hero tone</div>
              <div className="title-lg" style={{ marginTop: 4 }}>Accent-washed card</div>
              <Button variant="accent" className="w-full mt-4">
                Gradient accent button
              </Button>
            </Card>

            <Card tone="clay" interactive>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <CircleButton aria-label="Mark eaten">
                  <Icon name="check" size={16} />
                </CircleButton>
                <div style={{ flex: 1 }}>
                  <div className="title-md">Miso salmon bowl</div>
                  <div className="text-caption" style={{ marginTop: 4 }}>620 kcal · 42g protein</div>
                </div>
                <Illustration name="meal-dinner" size={72} />
              </div>
            </Card>

            <Card>
              <div className="eyebrow" style={{ marginBottom: 10 }}>This week</div>
              <WeeklyBars days={barDays} height={110} />
            </Card>

            <Card>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Weight</div>
              <span className="display-stat" style={{ fontSize: 34 }}>179.2</span>
              <TimeSparkline data={sparkData} width={340} height={90} />
            </Card>

            <Card>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Activity history</div>
              <Heatmap data={heatData} weeks={12} />
            </Card>

            <EmptyState
              illustration="empty-groceries"
              title="No plan for this week"
              body="Generate the plan to auto-build the grocery list."
            >
              <Button className="w-full mt-4">
                <Icon name="sparkle" size={16} /> Generate this week
              </Button>
            </EmptyState>

            <Card style={{ position: "relative", minHeight: 90 }}>
              <div className="eyebrow">Glass tooltip</div>
              <ChartTooltip x={140} y={80} seriesColor="var(--accent)" label="Jul 1">
                2,140 kcal
              </ChartTooltip>
            </Card>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Illustration name="rest-day" size={100} />
              <Illustration name="all-done" size={100} />
              <Illustration name="workout-done" size={100} />
              <Illustration name="welcome" size={100} />
            </div>

            <Card>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Week planning canvas</div>
              <WeekGrid
                days={WEEK_GRID_DAYS}
                slots={WEEK_GRID_SLOTS}
                todayDay="Wed"
                getCell={(day, slot) =>
                  WEEK_GRID_DEMO[`${day}:${slot}`] ?? { label: "Generate", tone: "generate", icon: "sparkle" }
                }
                onCellTap={() => {}}
              />
            </Card>

            <Card>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Plan-week dialogs</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" onClick={() => setCellSheetOpen(true)}>
                  Cell actions
                </Button>
                <Button variant="ghost" onClick={() => setLeftoverOpen(true)}>
                  Leftover repair
                </Button>
                <Button variant="ghost" onClick={() => setAddMealOpen(true)}>
                  Add meal
                </Button>
              </div>
            </Card>
          </div>
        </main>
        <BottomNav />
      </div>

      <div
        id="planweek-desktop-demo"
        className="hidden md:block"
        style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 24px 120px" }}
      >
        <div className="eyebrow" style={{ marginBottom: 12 }}>Week planner — desktop drag &amp; drop</div>
        <PlanWeekDesktopDemo />
      </div>

      <CellActionSheet
        open={cellSheetOpen}
        day="Wed"
        slot="dinner"
        hasExistingMeal
        onGenerate={() => setCellSheetOpen(false)}
        onPickFromBook={() => setCellSheetOpen(false)}
        onKeep={() => setCellSheetOpen(false)}
        onSkip={() => setCellSheetOpen(false)}
        onClose={() => setCellSheetOpen(false)}
      />

      <LeftoverRepairDialog
        open={leftoverOpen}
        sourceName="Miso salmon bowl"
        newSourceName="Chicken tikka"
        affected={[{ day: "Thu", index: 1, name: "Miso salmon bowl (leftovers)", sourceName: "Miso salmon bowl" }]}
        onUpdate={() => setLeftoverOpen(false)}
        onRegenerate={() => setLeftoverOpen(false)}
        onClose={() => setLeftoverOpen(false)}
      />

      <AddMealSheet
        open={addMealOpen}
        defaultSlot="snack"
        onGenerate={() => setAddMealOpen(false)}
        onPickFromBook={() => setAddMealOpen(false)}
        onClose={() => setAddMealOpen(false)}
      />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MemoryRouter>
      <Preview />
    </MemoryRouter>
  </StrictMode>,
);
