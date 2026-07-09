import { useState } from "react";
import { Card } from "../../../components/Card";
import { Chip } from "../../../components/Primitives";
import { Icon } from "../../../components/Icon";
import { SegmentedControl } from "../../../components/SegmentedControl";
import type {
  LeftoverPreference,
  Profile,
  VarietyStrength,
} from "../../../hooks/useProfile";
import { EditSheet, SectionHeader } from "../EditSheet";
import { SummaryRow, sectionLabelStyle } from "../fields";
import { getSaveErrorMessage } from "../helpers";
import type { SaveSection } from "../types";

const LEFTOVER_OPTIONS = [
  { value: "none", label: "Never" },
  { value: "occasional", label: "Sometimes" },
  { value: "often", label: "Often" },
] as const;

const LEFTOVER_LABEL: Record<LeftoverPreference, string> = {
  none: "Fresh every meal",
  occasional: "Occasional leftovers",
  often: "Leftover lunches",
};

const VARIETY_OPTIONS = [
  { value: "low", label: "Familiar" },
  { value: "medium", label: "Balanced" },
  { value: "high", label: "Adventurous" },
] as const;

const VARIETY_LABEL: Record<VarietyStrength, string> = {
  low: "Keep favorites coming",
  medium: "Balanced rotation",
  high: "Always something new",
};

interface MealPrefsDraft {
  leftoverPreference: LeftoverPreference;
  varietyStrength: VarietyStrength;
  cuisineLikes: string[];
  cuisineDislikes: string[];
  weeknightMaxMinutes: number | null;
  weekendRelaxed: boolean;
}

export function MealPrefsSection({
  profile,
  onSave,
  saving,
}: {
  profile: Profile;
  onSave: SaveSection;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MealPrefsDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openEditor = () => {
    setDraft({
      leftoverPreference: profile.leftoverPreference ?? "occasional",
      varietyStrength: profile.varietyStrength ?? "medium",
      cuisineLikes: profile.cuisineLikes ?? [],
      cuisineDislikes: profile.cuisineDislikes ?? [],
      weeknightMaxMinutes: profile.weeknightMaxMinutes ?? null,
      weekendRelaxed: profile.weekendRelaxed ?? true,
    });
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    if (!draft) return;
    try {
      await onSave(draft);
      setOpen(false);
    } catch (e) {
      setError(getSaveErrorMessage(e));
    }
  };

  const cuisineSummary =
    (profile.cuisineLikes?.length ?? 0) + (profile.cuisineDislikes?.length ?? 0) > 0
      ? [
          profile.cuisineLikes?.length ? `likes ${profile.cuisineLikes.length}` : null,
          profile.cuisineDislikes?.length ? `avoids ${profile.cuisineDislikes.length}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "None set";

  return (
    <div>
      <SectionHeader label="Meal preferences" onEdit={openEditor} className="px-2 pb-2" />
      <Card>
        <SummaryRow
          label="Leftovers"
          value={LEFTOVER_LABEL[profile.leftoverPreference ?? "occasional"]}
        />
        <SummaryRow
          label="Variety"
          value={VARIETY_LABEL[profile.varietyStrength ?? "medium"]}
        />
        <SummaryRow label="Cuisines" value={cuisineSummary} />
        <SummaryRow
          label="Weeknight time"
          value={
            profile.weeknightMaxMinutes
              ? `≤ ${profile.weeknightMaxMinutes} min${profile.weekendRelaxed !== false ? " · relaxed weekends" : ""}`
              : "No limit"
          }
          last
        />
      </Card>

      <EditSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Meal preferences"
        onSave={save}
        saving={saving}
        error={error}
        position="center"
      >
        {draft && (
          <div style={{ display: "grid", gap: 20 }}>
            <div>
              <div style={sectionLabelStyle}>Leftovers</div>
              <SegmentedControl
                options={LEFTOVER_OPTIONS}
                value={draft.leftoverPreference}
                onChange={(leftoverPreference) =>
                  setDraft((d) => (d ? { ...d, leftoverPreference } : d))
                }
                aria-label="Leftover preference"
                minSegmentWidth={84}
              />
              <div className="text-caption" style={{ marginTop: 6 }}>
                {draft.leftoverPreference === "often"
                  ? "Dinners are batch-sized so every lunch is leftovers."
                  : draft.leftoverPreference === "none"
                    ? "Every meal is cooked fresh — no batch dinners."
                    : "A few dinners each week feed the next day's lunch."}
              </div>
            </div>

            <div>
              <div style={sectionLabelStyle}>Variety</div>
              <SegmentedControl
                options={VARIETY_OPTIONS}
                value={draft.varietyStrength}
                onChange={(varietyStrength) =>
                  setDraft((d) => (d ? { ...d, varietyStrength } : d))
                }
                aria-label="Variety strength"
                minSegmentWidth={84}
              />
              <div className="text-caption" style={{ marginTop: 6 }}>
                {draft.varietyStrength === "high"
                  ? "New weeks strongly avoid anything from the last 3 weeks."
                  : draft.varietyStrength === "low"
                    ? "Repeats are fine — only last week is avoided."
                    : "New weeks avoid repeating the last 2 weeks."}
              </div>
            </div>

            <CuisineChips
              label="Cuisines you love"
              placeholder="e.g. thai, mexican…"
              values={draft.cuisineLikes}
              onChange={(cuisineLikes) => setDraft((d) => (d ? { ...d, cuisineLikes } : d))}
            />
            <CuisineChips
              label="Never show me"
              placeholder="e.g. mushrooms, tofu…"
              values={draft.cuisineDislikes}
              onChange={(cuisineDislikes) => setDraft((d) => (d ? { ...d, cuisineDislikes } : d))}
            />

            <div>
              <div style={sectionLabelStyle}>Weeknight time budget</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative", width: 130 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="field-input"
                    placeholder="No limit"
                    value={draft.weeknightMaxMinutes ?? ""}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              weeknightMaxMinutes:
                                e.target.value.trim() === "" || !Number.isFinite(n)
                                  ? null
                                  : Math.max(10, Math.min(180, Math.round(n))),
                            }
                          : d,
                      );
                    }}
                    style={{ paddingRight: 40 }}
                  />
                  <span
                    className="text-caption"
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  >
                    min
                  </span>
                </div>
                <button
                  type="button"
                  className="tappable"
                  onClick={() =>
                    setDraft((d) => (d ? { ...d, weekendRelaxed: !d.weekendRelaxed } : d))
                  }
                  aria-pressed={draft.weekendRelaxed}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "9px 12px",
                    borderRadius: 999,
                    border: "1px solid var(--hair)",
                    background: draft.weekendRelaxed ? "var(--wash-accent-strong)" : "transparent",
                    color: draft.weekendRelaxed ? "var(--accent-2)" : "var(--muted)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Icon name="check" size={12} stroke={2.5} />
                  Relax on weekends
                </button>
              </div>
              <div className="text-caption" style={{ marginTop: 6 }}>
                Caps prep + cook time for Mon–Fri dinners. Leave empty for no limit.
              </div>
            </div>
          </div>
        )}
      </EditSheet>
    </div>
  );
}

/** Tag input: type + Enter (or the add button) appends; tap a chip to remove. */
function CuisineChips({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [text, setText] = useState("");

  function add() {
    const v = text.trim().toLowerCase();
    if (!v || v.length > 40) return;
    if (values.some((x) => x.toLowerCase() === v)) {
      setText("");
      return;
    }
    if (values.length >= 20) return;
    onChange([...values, v]);
    setText("");
  }

  return (
    <div>
      <div style={sectionLabelStyle}>{label}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          className="field-input"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="tappable"
          onClick={add}
          aria-label={`Add to ${label.toLowerCase()}`}
          disabled={!text.trim()}
          style={{
            width: 44,
            borderRadius: "calc(var(--radius) * 0.7)",
            border: "1px solid var(--hair)",
            background: "var(--paper)",
            color: "var(--sumi)",
            cursor: text.trim() ? "pointer" : "not-allowed",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
      {values.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {values.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="tappable"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              <Chip>
                {v} <Icon name="x" size={10} />
              </Chip>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
