import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { Chip, PhoneHeader, Sparkline } from "../components/Primitives";
import { useLogProgress, useProgress } from "../hooks/useProgress";
import { useSettings } from "../hooks/useSettings";
import { formatWeight, kgToPounds, weightUnitLabel } from "../lib/units";

export function ProgressPage() {
  const { data: logs, isLoading } = useProgress();
  const settingsQuery = useSettings();
  const log = useLogProgress();
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState(false);
  const unitSystem = settingsQuery.data?.unitSystem ?? "imperial";
  const unitLabel = weightUnitLabel(unitSystem);

  const { series, latest, delta } = useMemo(() => {
    const sorted = [...(logs ?? [])].sort(
      (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
    );
    const ws = sorted
      .filter((l) => l.weightLbs != null)
      .map((l) => formatWeight(l.weightLbs as number, unitSystem));
    const last = ws.length ? ws[ws.length - 1] : null;
    const first = ws.length ? ws[0] : null;
    const d = last != null && first != null ? last - first : null;
    return { series: ws, latest: last, delta: d };
  }, [logs, unitSystem]);

  return (
    <Layout>
      <PhoneHeader
        title="Progress"
        subtitle={
          latest != null
            ? delta != null && delta !== 0
              ? `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta).toFixed(1)} ${unitLabel} over ${series.length} entries`
              : "Keep logging to see your trend."
            : "Log your first weight to start a trend line."
        }
      />

      {/* Chart */}
      <div className="px-4 pt-1">
        <Card>
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="eyebrow">Weight · recent</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  marginTop: 6,
                }}
              >
                <span
                  className="font-display"
                  style={{ fontSize: 32, color: "var(--ink)", lineHeight: 1 }}
                >
                  {latest != null ? latest.toFixed(1) : "—"}
                </span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{unitLabel}</span>
                {delta != null && delta !== 0 && (
                  <Chip
                    variant={delta < 0 ? "moss" : "honey"}
                    style={{ marginLeft: 6 }}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)}
                  </Chip>
                )}
              </div>
            </div>
          </div>
          {series.length > 1 ? (
            <Sparkline
              data={series.slice(-14)}
              width={340}
              height={80}
              color="var(--accent)"
            />
          ) : (
            <div
              style={{
                padding: "18px 0",
                textAlign: "center",
                color: "var(--muted)",
                fontSize: 12,
              }}
            >
              Two or more entries draws a line.
            </div>
          )}
        </Card>
      </div>

      {/* Log entry */}
      <div className="px-4 pt-4">
        <Card>
          <div className="eyebrow mb-3">Log today</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              log.mutate(
                {
                  weightLbs: weight
                    ? unitSystem === "metric"
                      ? kgToPounds(Number(weight))
                      : Number(weight)
                    : null,
                  note: note || undefined,
                },
                {
                  onSuccess: () => {
                    setWeight("");
                    setNote("");
                    setToast(true);
                    setTimeout(() => setToast(false), 1800);
                  },
                },
              );
            }}
          >
            <div className="flex gap-2.5 mb-2.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Weight"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="field-input"
                  style={{ paddingRight: 36 }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  {unitLabel}
                </span>
              </div>
              <Button
                type="submit"
                variant="accent"
                disabled={!weight || log.isPending}
              >
                {log.isPending ? "…" : "Log"}
              </Button>
            </div>
            <input
              type="text"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="field-input"
            />
            {toast && (
              <div
                className="fade-up"
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "var(--moss)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon name="check" size={14} /> Saved. Nice work.
              </div>
            )}
          </form>
        </Card>
      </div>

      {/* Recent */}
      {isLoading && (
        <div className="px-4 pt-4">
          <Card>Loading history…</Card>
        </div>
      )}
      {logs && logs.length > 0 && (
        <>
          <div className="px-6 pt-4 pb-2">
            <div className="eyebrow">Recent entries</div>
          </div>
          <div className="px-4">
            <Card flush>
              {logs.map((l, i) => (
                <div
                  key={l.id}
                  style={{
                    padding: "14px 18px",
                    borderBottom:
                      i < logs.length - 1 ? "1px solid var(--hair)" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--ink)",
                        fontWeight: 500,
                      }}
                    >
                      {new Date(l.loggedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    {l.note && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--muted)",
                          marginTop: 3,
                        }}
                      >
                        {l.note}
                      </div>
                    )}
                  </div>
                  {l.weightLbs != null && (
                    <div
                      className="font-display"
                      style={{ fontSize: 17, color: "var(--sumi)" }}
                    >
                      {formatWeight(l.weightLbs, unitSystem)}
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--muted)",
                          marginLeft: 2,
                        }}
                      >
                        {unitLabel}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </Layout>
  );
}
