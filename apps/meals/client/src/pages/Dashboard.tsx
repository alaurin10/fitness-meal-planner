import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { Chip, PhoneHeader } from "../components/Primitives";
import { useCurrentPlan, useGeneratePlan } from "../hooks/usePlan";
import { useProfile } from "../hooks/useProfile";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function formatDay(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function MacroRings({
  kcal,
  kcalTarget,
  protein,
  proteinTarget,
  size = 140,
}: {
  kcal: number;
  kcalTarget: number;
  protein: number;
  proteinTarget: number;
  size?: number;
}) {
  const rings = [
    { pct: kcal / kcalTarget, color: "var(--accent)", r: size / 2 - 8 },
    { pct: protein / proteinTarget, color: "var(--moss)", r: size / 2 - 22 },
  ];
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {rings.map((ring, i) => {
          const c = 2 * Math.PI * ring.r;
          const pct = Math.max(0, Math.min(1, ring.pct));
          return (
            <g key={i}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={ring.r}
                stroke="color-mix(in srgb, var(--muted) 15%, transparent)"
                strokeWidth="7"
                fill="none"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={ring.r}
                stroke={ring.color}
                strokeWidth="7"
                fill="none"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - pct)}
                strokeLinecap="round"
                style={{
                  transition:
                    "stroke-dashoffset 900ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                }}
              />
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="font-display"
          style={{ fontSize: size * 0.22, lineHeight: 1, color: "var(--ink)" }}
        >
          {kcal}
        </div>
        <div
          style={{
            fontSize: 9.5,
            color: "var(--muted)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginTop: 3,
          }}
        >
          of {kcalTarget}
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const profileQuery = useProfile();
  const planQuery = useCurrentPlan();
  const generate = useGeneratePlan();

  if (profileQuery.isLoading || planQuery.isLoading) {
    return (
      <Layout>
        <div className="px-4 py-4">
          <Card>Loading…</Card>
        </div>
      </Layout>
    );
  }

  const profile = profileQuery.data;
  const plan = planQuery.data;

  if (!profile) {
    return (
      <Layout>
        <PhoneHeader
          greeting={formatDay(new Date())}
          title="Welcome."
          subtitle="Set calories, protein, and any dietary notes to shape your first week."
        />
        <div className="px-4 pt-1">
          <Card tone="gradient">
            <div className="flex items-start gap-3">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: "var(--paper)",
                  color: "var(--moss)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="leaf" size={18} />
              </div>
              <div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 20,
                    color: "var(--ink)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Tell us what you're eating
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--sumi)",
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  A daily calorie target and a note or two — that's enough to start.
                </p>
              </div>
            </div>
            <Link to="/profile" className="block mt-5">
              <Button className="w-full">Set up profile</Button>
            </Link>
          </Card>
        </div>
      </Layout>
    );
  }

  const today = new Date();
  const todayLabel = DAY_LABELS[(today.getDay() + 6) % 7];
  const todayMeals = plan?.planJson.days.find((d) => d.day === todayLabel)?.meals ?? [];
  const kcal = todayMeals.reduce((s, m) => s + m.calories, 0);
  const protein = todayMeals.reduce((s, m) => s + m.proteinG, 0);
  const kcalTarget = profile.caloricTarget ?? plan?.planJson.dailyCalorieTarget ?? 2200;
  const proteinTarget = profile.proteinTargetG ?? 160;
  const nextMeal = todayMeals[0];

  return (
    <Layout>
      <PhoneHeader
        greeting={formatDay(today)}
        title={
          <>
            Simmering<br />
            something good.
          </>
        }
        subtitle={
          plan
            ? `${todayMeals.length} meals planned · ${kcal} kcal`
            : "Generate a weekly meal plan to begin."
        }
      />

      {plan ? (
        <>
          {/* Macros hero */}
          <div className="px-4 pt-1">
            <Card tone="gradient" className="flex items-center gap-4">
              <MacroRings
                kcal={kcal}
                kcalTarget={kcalTarget}
                protein={protein}
                proteinTarget={proteinTarget}
                size={130}
              />
              <div className="flex-1 flex flex-col gap-2.5">
                {[
                  {
                    label: "Calories",
                    val: kcal,
                    tgt: kcalTarget,
                    color: "var(--accent)",
                    unit: "kcal",
                  },
                  {
                    label: "Protein",
                    val: protein,
                    tgt: proteinTarget,
                    color: "var(--moss)",
                    unit: "g",
                  },
                ].map((m) => (
                  <div key={m.label}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11.5,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          color: "var(--sumi)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 99,
                            background: m.color,
                          }}
                        />
                        {m.label}
                      </span>
                      <span style={{ color: "var(--muted)" }}>
                        <b style={{ color: "var(--ink)", fontWeight: 500 }}>
                          {m.val}
                        </b>{" "}
                        / {m.tgt}
                        {m.unit === "g" ? "g" : ""}
                      </span>
                    </div>
                    <div className="prog" style={{ height: 4 }}>
                      <span
                        style={{
                          width: `${Math.min(100, (m.val / m.tgt) * 100)}%`,
                          background: m.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Up next */}
          {nextMeal && (
            <>
              <div className="px-6 pt-5 pb-2">
                <div className="eyebrow">Up next</div>
              </div>
              <div className="px-4">
                <Card flush className="flex">
                  <div
                    className="placeholder-photo"
                    style={{ width: 110, flexShrink: 0 }}
                  >
                    {abbr(nextMeal.name)}
                  </div>
                  <div style={{ padding: "14px 16px", flex: 1, minWidth: 0 }}>
                    <div className="eyebrow">
                      {nextMeal.calories} kcal · {nextMeal.proteinG}g
                    </div>
                    <div
                      className="font-display"
                      style={{
                        fontSize: 17,
                        color: "var(--ink)",
                        marginTop: 4,
                        lineHeight: 1.2,
                      }}
                    >
                      {nextMeal.name}
                    </div>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <Chip variant="moss">{nextMeal.proteinG}g protein</Chip>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* Today's meals */}
          {todayMeals.length > 0 && (
            <>
              <div className="px-6 pt-5 pb-2">
                <div className="eyebrow">Today</div>
              </div>
              <div className="px-4">
                <Card flush>
                  {todayMeals.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "13px 18px",
                        borderBottom:
                          i < todayMeals.length - 1
                            ? "1px solid var(--hair)"
                            : "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 8,
                          border: "1.5px solid var(--hair)",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13.5,
                            color: "var(--ink)",
                            fontWeight: 500,
                          }}
                        >
                          {m.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--muted)",
                            marginTop: 2,
                          }}
                        >
                          {m.calories} kcal · {m.proteinG}g protein
                        </div>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            </>
          )}

          {plan.planJson.summary && (
            <div className="px-4 pt-4">
              <Card tone="clay">
                <div className="eyebrow mb-2">This week</div>
                <div
                  style={{
                    fontSize: 13.5,
                    color: "var(--sumi)",
                    lineHeight: 1.55,
                  }}
                >
                  {plan.planJson.summary}
                </div>
              </Card>
            </div>
          )}

          <div className="px-4 pt-4 grid grid-cols-2 gap-2">
            <Link to="/plan">
              <Button variant="ghost" className="w-full">
                <Icon name="plan" size={16} /> Week plan
              </Button>
            </Link>
            <Link to="/groceries">
              <Button className="w-full">
                <Icon name="groceries" size={16} /> Groceries
              </Button>
            </Link>
          </div>
          <div className="px-4 pt-2">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              <Icon name="sparkle" size={16} />
              {generate.isPending ? "Regenerating…" : "Regenerate plan"}
            </Button>
          </div>
          {generate.isError && (
            <div className="px-4 pt-3">
              <Card tone="clay">
                <p style={{ color: "var(--rose)", fontSize: 13 }}>
                  {(generate.error as Error).message}
                </p>
              </Card>
            </div>
          )}
        </>
      ) : (
        <div className="px-4 pt-1">
          <Card tone="gradient">
            <div className="eyebrow">This week</div>
            <div
              className="font-display mt-1"
              style={{ fontSize: 24, color: "var(--ink)", letterSpacing: "-0.01em" }}
            >
              No active plan
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--sumi)",
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              We'll shape a week around your calorie target and any training days
              already on your schedule.
            </p>
            <Button
              className="w-full mt-5"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              <Icon name="sparkle" size={16} />
              {generate.isPending ? "Generating…" : "Generate plan"}
            </Button>
            {generate.isError && (
              <p
                style={{
                  color: "var(--rose)",
                  fontSize: 12.5,
                  marginTop: 12,
                }}
              >
                {(generate.error as Error).message}
              </p>
            )}
          </Card>
        </div>
      )}
    </Layout>
  );
}

function abbr(s: string) {
  return (s.split(/[·,]/)[0] ?? s)
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 14);
}
