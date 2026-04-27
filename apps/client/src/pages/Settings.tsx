import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { PhoneHeader } from "../components/Primitives";
import { useSaveSettings, useSettings } from "../hooks/useSettings";

export function SettingsPage() {
  const settingsQuery = useSettings();
  const save = useSaveSettings();
  const [unitSystem, setUnitSystem] = useState<"imperial" | "metric">("imperial");
  const [hydrationGoal, setHydrationGoal] = useState(8);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (settingsQuery.data?.unitSystem) {
      setUnitSystem(settingsQuery.data.unitSystem);
    }
    if (settingsQuery.data?.hydrationGoal != null) {
      setHydrationGoal(settingsQuery.data.hydrationGoal);
    }
  }, [settingsQuery.data?.unitSystem, settingsQuery.data?.hydrationGoal]);

  return (
    <Layout>
      <PhoneHeader
        title="Settings"
        subtitle="Global preferences that apply across the app."
      />

      <div className="px-4 pt-2">
        <Card>
          <div className="eyebrow">Units</div>
          <div
            className="font-display"
            style={{ fontSize: 24, color: "var(--ink)", marginTop: 6 }}
          >
            Choose your default system
          </div>
          <div style={{ fontSize: 13, color: "var(--sumi)", marginTop: 6, lineHeight: 1.5 }}>
            Weight logs, workout loads, and profile entry will follow this choice.
          </div>

          <div style={{ marginTop: 18 }}>
            <UnitToggle value={unitSystem} onChange={setUnitSystem} />
          </div>

          <Button
            className="w-full mt-5"
            onClick={() =>
              save.mutate(
                { unitSystem, hydrationGoal },
                {
                  onSuccess: () => {
                    setToast(true);
                    setTimeout(() => setToast(false), 1800);
                  },
                },
              )
            }
            disabled={save.isPending || settingsQuery.isLoading}
          >
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>

          {save.isError && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--rose)", textAlign: "center" }}>
              {(save.error as Error).message}
            </div>
          )}

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
                justifyContent: "center",
              }}
            >
              <Icon name="check" size={14} /> Settings saved.
            </div>
          )}
        </Card>
      </div>

      <div className="px-4 pt-3">
        <Card>
          <div className="eyebrow">Hydration</div>
          <div
            className="font-display"
            style={{ fontSize: 24, color: "var(--ink)", marginTop: 6 }}
          >
            Daily cup goal
          </div>
          <div style={{ fontSize: 13, color: "var(--sumi)", marginTop: 6, lineHeight: 1.5 }}>
            How many cups or drinks you want to aim for each day.
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <button
              type="button"
              className="tappable"
              onClick={() => setHydrationGoal((g) => Math.max(1, g - 1))}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "1px solid var(--hair)",
                background: "var(--paper)",
                color: "var(--ink)",
                fontSize: 20,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Decrease goal"
            >
              &minus;
            </button>
            <span
              className="font-display"
              style={{ fontSize: 28, color: "var(--ink)", minWidth: 36, textAlign: "center" }}
            >
              {hydrationGoal}
            </span>
            <button
              type="button"
              className="tappable"
              onClick={() => setHydrationGoal((g) => Math.min(20, g + 1))}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "1px solid var(--hair)",
                background: "var(--paper)",
                color: "var(--ink)",
                fontSize: 20,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Increase goal"
            >
              +
            </button>
            <span style={{ fontSize: 13, color: "var(--sumi)" }}>cups / day</span>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

function UnitToggle({
  value,
  onChange,
}: {
  value: "imperial" | "metric";
  onChange: (value: "imperial" | "metric") => void;
}) {
  return (
    <div
      style={{
        display: "inline-grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 4,
        padding: 4,
        borderRadius: 999,
        border: "1px solid var(--hair)",
        background: "color-mix(in srgb, var(--clay) 45%, var(--paper))",
      }}
    >
      {([
        ["imperial", "Imperial"],
        ["metric", "Metric"],
      ] as const).map(([option, label]) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className="tappable"
            aria-pressed={active}
            style={{
              minWidth: 96,
              padding: "10px 14px",
              border: "none",
              borderRadius: 999,
              background: active ? "var(--ink)" : "transparent",
              color: active ? "var(--paper)" : "var(--sumi)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
