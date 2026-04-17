import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Layout } from "../components/Layout";
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
      <Layout title="Groceries">
        <Card>Loading…</Card>
      </Layout>
    );
  }

  if (!list || list.items.length === 0) {
    return (
      <Layout title="Groceries">
        <Card>
          <p className="text-muted text-sm">
            No grocery list yet. Generate a meal plan first.
          </p>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout title="Groceries">
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

  return (
    <>
      <Card accent>
        <div className="flex items-center justify-between">
          <p className="text-sm">
            <span className="text-text">{checked}</span>
            <span className="text-muted"> of {total} gotten</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={onClear}
              disabled={!hasChecked}
            >
              Clear checked
            </Button>
            <Button
              variant="ghost"
              onClick={onPush}
              disabled={pushing}
              title="Optional: push to iOS Reminders via Shortcut"
            >
              {pushing ? "Pushing…" : "Push to Reminders"}
            </Button>
          </div>
        </div>
        {pushedAt && (
          <p className="text-xs text-muted mt-2">
            Last pushed: {new Date(pushedAt).toLocaleString()}
          </p>
        )}
      </Card>

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
    <Card>
      <button
        type="button"
        className="flex w-full items-center justify-between"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg">{category}</h2>
          <span className="text-xs text-muted">
            {remaining} / {items.length}
          </span>
        </div>
        <span className="text-muted text-xs">{collapsed ? "▾" : "▴"}</span>
      </button>
      {!collapsed && (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 border-b border-border last:border-b-0 pb-2 last:pb-0"
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => onToggle(item.id, e.target.checked)}
                className="h-5 w-5 accent-accent shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${
                    item.checked ? "text-muted line-through" : "text-text"
                  }`}
                >
                  {item.name}
                </p>
              </div>
              <span className="text-muted text-xs shrink-0">{item.qty}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function groupByCategory(items: GroceryItem[]): Record<GroceryCategory, GroceryItem[]> {
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
