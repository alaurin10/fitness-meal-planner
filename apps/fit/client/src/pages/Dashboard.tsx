import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { Chip, PhoneHeader, Ring } from "../components/Primitives";
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
          subtitle="Set up your profile so we can shape your first training week."
        />
        <div className="px-4 pt-2">
          <Card tone="gradient">
            <div className="flex items-start gap-3">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: "var(--paper)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="sparkle" size={18} />
              </div>
              <div>
                <div
                  className="font-display"
                  style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em" }}
                >
                  Start with your numbers
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--sumi)",
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  Age, weight, experience, and a goal — that's all the plan needs.
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
  const planDays = plan?.planJson.days ?? [];
  const todayPlan = planDays.find((d) => d.day === todayLabel);
  const exerciseCount = todayPlan?.exercises.length ?? 0;

  return (
    <Layout>
      <PhoneHeader
        greeting={formatDay(today)}
        title={
          <>
            Good day,<br />
            you.
          </>
        }
        subtitle={
          plan
            ? todayPlan
              ? `${todayPlan.focus} · ${exerciseCount} exercises.`
              : "Rest day on today's plan."
            : "Generate this week's training plan to begin."
        }
      />

      {plan ? (
        <>
          {/* Today's focus */}
          <div className="px-4 pt-1">
            <Card tone="gradient" className="fade-up">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="eyebrow">Today's focus</div>
                  <div
                    className="font-display mt-1"
                    style={{ fontSize: 24, color: "var(--ink)", letterSpacing: "-0.01em" }}
                  >
                    {todayPlan ? todayPlan.focus : "Rest"}
                  </div>
                </div>
                {todayPlan && (
                  <Ring value={0} size={58} stroke={6} color="var(--accent)">
                    <div
                      className="font-display"
                      style={{ fontSize: 14, color: "var(--ink)" }}
                    >
                      0/{exerciseCount}
                    </div>
                  </Ring>
                )}
              </div>
              {todayPlan && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <Chip>{exerciseCount} exercises</Chip>
                  <Chip variant="moss">Session</Chip>
                  <Chip variant="honey">Moderate</Chip>
                </div>
              )}
              <Link to="/plan" className="block">
                <Button className="w-full">
                  {todayPlan ? "Begin session" : "View plan"}
                  <Icon name="chevron" size={16} />
                </Button>
              </Link>
            </Card>
          </div>

          {/* Week strip */}
          <div className="px-6 pt-5 pb-2">
            <div className="eyebrow">This week</div>
          </div>
          <div className="px-4">
            <Card className="!px-3 !py-3.5">
              <div className="grid grid-cols-7 gap-0.5">
                {DAY_LABELS.map((d, i) => {
                  const day = planDays.find((dd) => dd.day === d);
                  const isToday = d === todayLabel;
                  const isRest = !day || day.focus.toLowerCase().includes("rest");
                  return (
                    <div
                      key={d}
                      style={{
                        textAlign: "center",
                        padding: "10px 0 8px",
                        borderRadius: "calc(var(--radius) * 0.6)",
                        background: isToday ? "var(--ink)" : "transparent",
                        color: isToday ? "var(--paper)" : "var(--ink)",
                      }}
                    >
                      <div style={{ fontSize: 10, letterSpacing: "0.1em", opacity: 0.6 }}>
                        {d.charAt(0)}
                      </div>
                      <div
                        className="font-display"
                        style={{ fontSize: 16, marginTop: 2 }}
                      >
                        {isRest ? "·" : day?.exercises.length ?? "·"}
                      </div>
                      <div
                        style={{
                          fontSize: 8.5,
                          opacity: isRest ? 0.4 : 0.7,
                          marginTop: 3,
                          letterSpacing: "0.04em",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          padding: "0 2px",
                        }}
                      >
                        {day?.focus ?? "Rest"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Progression note */}
          {plan.planJson.progressionNotes && (
            <div className="px-4 pt-4">
              <Card tone="clay">
                <div className="flex items-start gap-3">
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      background: "var(--paper)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="sparkle" size={18} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--sumi)",
                        fontWeight: 500,
                        marginBottom: 4,
                      }}
                    >
                      Progression note
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--sumi)",
                        lineHeight: 1.5,
                      }}
                    >
                      {plan.planJson.progressionNotes}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Summary */}
          {plan.planJson.summary && (
            <div className="px-4 pt-4">
              <Card>
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
                <Icon name="plan" size={16} />
                Full plan
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              <Icon name="sparkle" size={16} />
              {generate.isPending ? "Regenerating…" : "Regenerate"}
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
              Generate a weekly training plan shaped by your profile.
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
