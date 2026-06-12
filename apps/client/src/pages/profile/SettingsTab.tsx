import { ALL_DAYS, type WeekStartDay } from "@platform/shared";
import { Card } from "../../components/Card";
import { SegmentedControl } from "../../components/SegmentedControl";
import { useToast } from "../../components/Toast";
import { useSaveSettings, useSettings } from "../../hooks/useSettings";
import { useTheme, type ThemePreference } from "../../lib/theme";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

const PALETTE_OPTIONS = [
  { value: "earthy", label: "Terracotta" },
  { value: "carbon", label: "Carbon" },
] as const;

/**
 * Every control persists immediately on change. useSaveSettings applies the
 * change optimistically and rolls it back on error, so the only feedback
 * needed is an error toast.
 */
export function SettingsTab() {
  const settingsQuery = useSettings();
  const save = useSaveSettings();
  const theme = useTheme();
  const toast = useToast();

  const unitSystem = settingsQuery.data?.unitSystem ?? "imperial";
  const weekStartDay = settingsQuery.data?.weekStartDay ?? "Mon";

  const changeTheme = (pref: ThemePreference) => {
    theme.setPreference(pref);
    // Persist quietly so the preference follows the user across devices.
    save.mutate({ theme: pref });
  };

  const persist = (input: { unitSystem?: "imperial" | "metric"; weekStartDay?: WeekStartDay }) => {
    save.mutate(input, {
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    <div className="px-4 pt-2 space-y-3">
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
          Default system
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
            onChange={(value) => persist({ unitSystem: value })}
            aria-label="Unit system"
            minSegmentWidth={96}
          />
        </div>
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
                onClick={() => persist({ weekStartDay: d })}
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
  );
}
