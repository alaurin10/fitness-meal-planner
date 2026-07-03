// Dev-only design-system preview (served by `vite dev` at /preview.html).
// Renders the redesigned primitives without Clerk/API so the four
// palette×theme combos can be screenshotted. Not part of the app build.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "./index.css";
import { BottomNav } from "./components/BottomNav";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { ChartTooltip } from "./components/ChartTooltip";
import { CircleButton } from "./components/CircleButton";
import { EmptyState } from "./components/EmptyState";
import { Heatmap } from "./components/Heatmap";
import { Icon } from "./components/Icon";
import { Illustration } from "./components/Illustration";
import { ProgressRing } from "./components/ProgressRing";
import { Chip, PageHero, Ring, TimeSparkline } from "./components/Primitives";
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

function Preview() {
  return (
    <>
      <div aria-hidden className="ambient-bg" />
      <div className="mx-auto max-w-[480px] min-h-screen relative pb-[100px]">
        <main className="relative overflow-x-clip">
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
          </div>
        </main>
        <BottomNav />
      </div>
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
