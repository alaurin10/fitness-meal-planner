import { useEffect, useState } from "react";
import { ALL_DAYS, type WeekStartDay } from "@platform/shared";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Layout } from "../components/Layout";
import { PhoneHeader } from "../components/Primitives";
import { SegmentedControl } from "../components/SegmentedControl";
import { useToast } from "../components/Toast";
import { useSaveSettings, useSettings } from "../hooks/useSettings";
import { useTheme, type ThemePreference } from "../lib/theme";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

const PALETTE_OPTIONS = [
  { value: "earthy", label: "Terracotta" },
  { value: "carbon", label: "Carbon" },
] as const;

export function SettingsPage() {
  const settingsQuery = useSettings();
  const save = useSaveSettings();
  const theme = useTheme();
  const toast = useToast();
  const [unitSystem, setUnitSystem] = useState<"imperial" | "metric">("imperial");
  const [weekStartDay, setWeekStartDay] = useState<WeekStartDay>("Mon");

  useEffect(() => {
    if (settingsQuery.data?.unitSystem) {
      setUnitSystem(settingsQuery.data.unitSystem);
    }
    if (settingsQuery.data?.weekStartDay) {
      setWeekStartDay(settingsQuery.data.weekStartDay);
    }
  }, [settingsQuery.data?.unitSystem, settingsQuery.data?.weekStartDay]);

  const changeTheme = (pref: ThemePreference) => {
    theme.setPreference(pref);
    // Persist quietly so the preference follows the user across devices.
    save.mutate({ theme: pref });
  };

  return (
    <Layout>
      <PhoneHeader
        title="Settings"
        subtitle="Global preferences that apply across the app."
      />

      <div className="px-4 pt-2">
        <Card>
          <div className="eyebrow">Appearance</div>
          <div
            className="font-display"
            style={{ fontSize: 24, color: "var(--ink)", marginTop: 6 }}
          >
            Theme
          </div>
          <div style={{ fontSize: 13, color: "var(--sumi)", marginTop: 6, lineHeight: 1.5 }}>
            Applies immediately. System follows your device setting.
          </div>
          <div style={{ marginTop: 14 }}>
            <SegmentedControl
              options={THEME_OPTIONS}
              value={theme.preference}
              onChange={changeTheme}
              aria-label="Theme"
            />
          </div>

          <div style={{ fontSize: 13, color: "var(--sumi)", marginTop: 18, lineHeight: 1.5 }}>
            Style
          </div>
          <div style={{ marginTop: 8 }}>
            <SegmentedControl
              options={PALETTE_OPTIONS}
              value={theme.palette}
              onChange={theme.setPalette}
              aria-label="Color style"
            />
          </div>
        </Card>

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
            <SegmentedControl
              options={[
                { value: "imperial", label: "Imperial" },
                { value: "metric", label: "Metric" },
              ]}
              value={unitSystem}
              onChange={setUnitSystem}
              aria-label="Unit system"
              minSegmentWidth={96}
            />
          </div>

          <Button
            className="w-full mt-5"
            onClick={() =>
              save.mutate(
                { unitSystem, weekStartDay },
                {
                  onSuccess: () => toast.success("Settings saved"),
                  onError: (e) => toast.error((e as Error).message),
                },
              )
            }
            disabled={save.isPending || settingsQuery.isLoading}
          >
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </Card>

        <Card>
          <div className="eyebrow">Week starts on</div>
          <div style={{ fontSize: 13, color: "var(--sumi)", marginTop: 6, lineHeight: 1.5 }}>
            Controls day order on Meals, Workouts, and Progress.
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 14,
            }}
          >
            {ALL_DAYS.map((d) => {
              const active = weekStartDay === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setWeekStartDay(d)}
                  className="tappable"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid var(--hair)",
                    borderRadius: 999,
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--bg)" : "var(--sumi)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
