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

// Literal palette colors are sanctioned here (like index.html's anti-flash
// map): each preview must show its own palette's colors regardless of the
// currently active theme vars. Keep in sync with tokens.css.
const PALETTE_PREVIEWS = [
  {
    value: "earthy" as const,
    label: "Terracotta",
    light: { bg: "#F4EADB", paper: "#FAF3E6", accent: "#C77D4F", ink: "#3A2E24" },
    dark: { bg: "#1A1410", paper: "#241C16", accent: "#D98C5C", ink: "#F2E8D9" },
  },
  {
    value: "carbon" as const,
    label: "Carbon",
    light: { bg: "#F4F5F7", paper: "#FFFFFF", accent: "#4F7DF9", ink: "#16181B" },
    dark: { bg: "#0E0F11", paper: "#1A1C1F", accent: "#D4FF4F", ink: "#F5F6F7" },
  },
];

function PaletteSwatch({
  colors,
}: {
  colors: { bg: string; paper: string; accent: string; ink: string };
}) {
  return (
    <div style={{ flex: 1, background: colors.bg, padding: "10px 8px 8px" }}>
      <div
        style={{
          background: colors.paper,
          borderRadius: 7,
          padding: "6px 7px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ width: 22, height: 4, borderRadius: 2, background: colors.ink, opacity: 0.85 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: colors.accent }} />
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: colors.ink, opacity: 0.25 }} />
        </div>
      </div>
    </div>
  );
}

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
    theme.setPreference(pref, { animate: true });
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
        <div
          role="radiogroup"
          aria-label="Color style"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}
        >
          {PALETTE_PREVIEWS.map((p) => {
            const active = theme.palette === p.value;
            return (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => theme.setPalette(p.value, { animate: true })}
                className="tappable press-spring"
                style={{
                  padding: 0,
                  border: active ? "2px solid var(--accent)" : "1px solid var(--hair)",
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                  background: "var(--paper)",
                  cursor: "pointer",
                  boxShadow: active ? "var(--shadow-md)" : "var(--shadow-sm)",
                  transition: "border-color 180ms ease, box-shadow 180ms ease",
                }}
              >
                {/* Light and dark side by side so the choice shows both moods */}
                <div aria-hidden style={{ display: "flex" }}>
                  <PaletteSwatch colors={p.light} />
                  <PaletteSwatch colors={p.dark} />
                </div>
                <div
                  style={{
                    padding: "8px 10px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: active ? "var(--accent-2)" : "var(--sumi)",
                    textAlign: "left",
                  }}
                >
                  {p.label}
                </div>
              </button>
            );
          })}
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
