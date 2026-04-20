import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { PhoneHeader, Ring } from "../components/Primitives";
import {
  useClearChecked,
  useGroceries,
  usePushToReminders,
  useToggleItem,
} from "../hooks/useGroceries";
import {
  GROCERY_CATEGORIES,
  type GroceryCategory,
  type GroceryItem,
} from "../lib/types";

export function GroceriesPage() {
  const { data: list, isLoading } = useGroceries();
  const toggle = useToggleItem();
  const clear = useClearChecked();
  const push = usePushToReminders();

  if (isLoading) {
    return (
      <Layout>
        <div className="px-4 py-4">
          <Card>Loading…</Card>
        </div>
      </Layout>
    );
  }

  if (!list || list.items.length === 0) {
    return (
      <Layout>
        <PhoneHeader
          title="Market"
          subtitle="Generate a meal plan to fill your list."
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <ListBody
        items={list.items}
        onToggle={(id, checked) => toggle.mutate({ itemId: id, checked })}
        onClear={() => clear.mutate()}
        onPush={() => push.mutate()}
        pushing={push.isPending}
        pushedAt={list.pushedToRemindersAt}
      />
    </Layout>
  );
}

function ListBody({
  items,
  onToggle,
  onClear,
  onPush,
  pushing,
  pushedAt,
}: {
  items: GroceryItem[];
  onToggle: (id: string, checked: boolean) => void;
  onClear: () => void;
  onPush: () => void;
  pushing: boolean;
  pushedAt: string | null;
}) {
  const byCategory = useMemo(() => groupByCategory(items), [items]);
  const total = items.length;
  const checked = items.filter((i) => i.checked).length;
  const hasChecked = checked > 0;
  const pct = total > 0 ? checked / total : 0;

  return (
    <>
      <PhoneHeader
        title="Market"
        subtitle={
          total > 0
            ? `${total - checked} items left for the week.`
            : "Nothing to pick up."
        }
      />

      {/* Progress hero */}
      <div className="px-4 pt-1">
        <Card tone="gradient" className="flex items-center gap-4">
          <Ring
            value={pct}
            size={96}
            color="var(--moss)"
            label={`${checked}/${total}`}
            sublabel="Gotten"
          />
          <div className="flex-1 flex flex-col gap-2">
            <div
              className="font-display"
              style={{
                fontSize: 18,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
              }}
            >
              {pct >= 1
                ? "Pantry stocked."
                : pct > 0
                  ? "A good start."
                  : "Ready to gather."}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--sumi)" }}>
              {checked} of {total} marked off.
            </div>
            {pushedAt && (
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                Synced {new Date(pushedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="px-4 pt-3 grid grid-cols-2 gap-2">
        <Button
          variant="ghost"
          onClick={onClear}
          disabled={!hasChecked}
          className="w-full"
        >
          <Icon name="check" size={14} /> Clear checked
        </Button>
        <Button
          variant="ghost"
          onClick={onPush}
          disabled={pushing}
          className="w-full"
          title="Push to iOS Reminders via Shortcut"
        >
          <Icon name="share" size={14} />
          {pushing ? "Pushing…" : "Send to Reminders"}
        </Button>
      </div>

      {/* Categories */}
      <div className="pt-1">
        {GROCERY_CATEGORIES.map((category) => {
          const entries = byCategory[category] ?? [];
          if (entries.length === 0) return null;
          return (
            <CategorySection
              key={category}
              category={category}
              items={entries}
              onToggle={onToggle}
            />
          );
        })}
      </div>
    </>
  );
}

function CategorySection({
  category,
  items,
  onToggle,
}: {
  category: GroceryCategory;
  items: GroceryItem[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const remaining = items.filter((i) => !i.checked).length;
  return (
    <>
      <div className="px-6 pt-4 pb-2">
        <button
          type="button"
          className="tappable flex w-full items-center justify-between"
          onClick={() => setCollapsed((c) => !c)}
          style={{ background: "none", border: "none", padding: 0 }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div className="eyebrow">{category}</div>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {remaining} / {items.length}
            </span>
          </div>
          <span
            style={{
              color: "var(--muted)",
              display: "inline-flex",
              transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 200ms",
            }}
          >
            <Icon name="chevron-down" size={16} />
          </span>
        </button>
      </div>
      {!collapsed && (
        <div className="px-4">
          <Card flush>
            {items.map((item, i) => (
              <label
                key={item.id}
                className="tappable"
                style={{
                  padding: "13px 18px",
                  borderBottom:
                    i < items.length - 1 ? "1px solid var(--hair)" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                }}
              >
                <CheckBox
                  checked={item.checked}
                  onChange={(c) => onToggle(item.id, c)}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      color: item.checked ? "var(--muted)" : "var(--ink)",
                      fontWeight: 500,
                      textDecoration: item.checked ? "line-through" : "none",
                      transition: "color 180ms",
                    }}
                  >
                    {item.name}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11.5,
                    color: "var(--muted)",
                    letterSpacing: "0.03em",
                    fontFamily: "var(--font-mono)",
                    flexShrink: 0,
                  }}
                >
                  {item.qty}
                </span>
              </label>
            ))}
          </Card>
        </div>
      )}
    </>
  );
}

function CheckBox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: 8,
        border: "1.5px solid " + (checked ? "var(--moss)" : "var(--hair)"),
        background: checked ? "var(--moss)" : "transparent",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--paper)",
        flexShrink: 0,
        transition: "background 180ms, border-color 180ms",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
        }}
      />
      {checked && <Icon name="check" size={13} stroke={2.5} />}
    </span>
  );
}

function groupByCategory(
  items: GroceryItem[],
): Record<GroceryCategory, GroceryItem[]> {
  const out: Record<GroceryCategory, GroceryItem[]> = {
    Produce: [],
    Protein: [],
    Dairy: [],
    Pantry: [],
    Frozen: [],
    Other: [],
  };
  for (const item of items) {
    out[item.category].push(item);
  }
  return out;
}
