import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { PhoneHeader, Ring } from "../components/Primitives";
import {
  useAddGroceryItem,
  useClearChecked,
  useDeleteGroceryItem,
  useGroceries,
  usePushToReminders,
  useRebuildGroceries,
  useToggleItem,
  useUpdateGroceryItem,
} from "../hooks/useGroceries";
import {
  GROCERY_CATEGORIES,
  type GroceryCategory,
  type GroceryItem,
} from "../lib/types";

export function GroceriesPage() {
  const { data: list, isLoading } = useGroceries();
  const toggle = useToggleItem();
  const update = useUpdateGroceryItem();
  const remove = useDeleteGroceryItem();
  const add = useAddGroceryItem();
  const clear = useClearChecked();
  const push = usePushToReminders();
  const rebuild = useRebuildGroceries();

  if (isLoading) {
    return (
      <Layout>
        <div className="px-4 py-4">
          <Card>Loading…</Card>
        </div>
      </Layout>
    );
  }

  const items = list?.items ?? [];

  return (
    <Layout>
      <ListBody
        items={items}
        pushedAt={list?.pushedToRemindersAt ?? null}
        hasList={!!list}
        onToggle={(id, checked) => toggle.mutate({ itemId: id, checked })}
        onUpdate={(itemId, patch) => update.mutate({ itemId, patch })}
        onDelete={(itemId) => remove.mutate(itemId)}
        onAdd={(input) => add.mutate(input)}
        onClear={() => clear.mutate()}
        onPush={() => push.mutate()}
        onRebuild={() => rebuild.mutate()}
        pushing={push.isPending}
        rebuilding={rebuild.isPending}
      />
    </Layout>
  );
}

interface ListBodyProps {
  items: GroceryItem[];
  pushedAt: string | null;
  hasList: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onUpdate: (
    itemId: string,
    patch: { name?: string; qty?: string; category?: GroceryCategory },
  ) => void;
  onDelete: (itemId: string) => void;
  onAdd: (input: {
    name: string;
    qty?: string;
    category?: GroceryCategory;
  }) => void;
  onClear: () => void;
  onPush: () => void;
  onRebuild: () => void;
  pushing: boolean;
  rebuilding: boolean;
}

function ListBody({
  items,
  pushedAt,
  hasList,
  onToggle,
  onUpdate,
  onDelete,
  onAdd,
  onClear,
  onPush,
  onRebuild,
  pushing,
  rebuilding,
}: ListBodyProps) {
  const byCategory = useMemo(() => groupByCategory(items), [items]);
  const total = items.length;
  const checked = items.filter((i) => i.checked).length;
  const hasChecked = checked > 0;
  const pct = total > 0 ? checked / total : 0;
  const [openAdd, setOpenAdd] = useState<GroceryCategory | null>(null);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddQty, setQuickAddQty] = useState("");

  function handleQuickAdd() {
    const name = quickAddName.trim();
    if (!name) return;
    onAdd({ name, qty: quickAddQty.trim() || undefined });
    setQuickAddName("");
    setQuickAddQty("");
  }

  return (
    <>
      <PhoneHeader
        title="Market"
        subtitle={
          total > 0
            ? `${total - checked} items left for the week.`
            : hasList
              ? "Empty list — add items below or rebuild from your plan."
              : "Generate a meal plan, or just start adding items."
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
              {total === 0
                ? "Nothing on the list yet."
                : pct >= 1
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
          disabled={pushing || total === 0}
          className="w-full"
          title="Push to iOS Reminders via Shortcut"
        >
          <Icon name="share" size={14} />
          {pushing ? "Pushing…" : "Send to Reminders"}
        </Button>
      </div>
      <div className="px-4 pt-2">
        <Button
          variant="ghost"
          onClick={onRebuild}
          disabled={rebuilding}
          className="w-full"
          title="Rebuild auto items from your current meal plan"
        >
          <Icon name="sparkle" size={14} />
          {rebuilding ? "Rebuilding…" : "Rebuild from plan"}
        </Button>
      </div>

      {/* Quick add — auto-categorized from item name */}
      <div className="px-4 pt-3">
        <Card flush>
          <div
            style={{
              padding: "10px 12px",
              display: "grid",
              gridTemplateColumns: "1fr 80px auto",
              gap: 6,
              alignItems: "center",
            }}
          >
            <input
              className="field-input"
              placeholder="Quick add — e.g. avocado"
              value={quickAddName}
              onChange={(e) => setQuickAddName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQuickAdd();
              }}
            />
            <input
              className="field-input"
              placeholder="Qty"
              value={quickAddQty}
              onChange={(e) => setQuickAddQty(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQuickAdd();
              }}
            />
            <Button
              onClick={handleQuickAdd}
              disabled={!quickAddName.trim()}
              style={{ padding: "8px 12px" }}
              title="Auto-sorted into a category from the item name"
            >
              <Icon name="plus" size={13} />
            </Button>
          </div>
          <div
            style={{
              padding: "0 14px 8px",
              fontSize: 10.5,
              color: "var(--muted)",
              letterSpacing: "0.04em",
            }}
          >
            Sorted into a category automatically. Tap a row to change it.
          </div>
        </Card>
      </div>

      {/* Categories */}
      <div className="pt-1">
        {GROCERY_CATEGORIES.map((category) => {
          const entries = byCategory[category] ?? [];
          // Always show category if it has items OR if it's the one being added to.
          if (entries.length === 0 && openAdd !== category) return null;
          return (
            <CategorySection
              key={category}
              category={category}
              items={entries}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAdd={(input) => {
                onAdd(input);
                setOpenAdd(null);
              }}
              isAdding={openAdd === category}
              onOpenAdd={() => setOpenAdd(category)}
              onCloseAdd={() => setOpenAdd(null)}
            />
          );
        })}
      </div>

      {/* Disclosure to explicitly target an empty category. */}
      <div className="px-4 pt-3 pb-2">
        <details>
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              fontSize: 12.5,
              color: "var(--sumi)",
              padding: "8px 4px",
            }}
          >
            + Add to a specific category…
          </summary>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 6,
            }}
          >
            {GROCERY_CATEGORIES.filter(
              (c) => (byCategory[c]?.length ?? 0) === 0,
            ).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setOpenAdd(c)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 99,
                  border: "1px solid var(--hair)",
                  background: "var(--paper)",
                  fontSize: 12,
                  color: "var(--ink)",
                  cursor: "pointer",
                }}
              >
                + {c}
              </button>
            ))}
          </div>
        </details>
      </div>
    </>
  );
}

interface CategorySectionProps {
  category: GroceryCategory;
  items: GroceryItem[];
  onToggle: (id: string, checked: boolean) => void;
  onUpdate: (
    itemId: string,
    patch: { name?: string; qty?: string; category?: GroceryCategory },
  ) => void;
  onDelete: (itemId: string) => void;
  onAdd: (input: {
    name: string;
    qty?: string;
    category: GroceryCategory;
  }) => void;
  isAdding: boolean;
  onOpenAdd: () => void;
  onCloseAdd: () => void;
}

function CategorySection({
  category,
  items,
  onToggle,
  onUpdate,
  onDelete,
  onAdd,
  isAdding,
  onOpenAdd,
  onCloseAdd,
}: CategorySectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
              {items.length === 0
                ? "0"
                : `${remaining} / ${items.length}`}
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
            {items.map((item, i) => {
              const isLast = i === items.length - 1 && !isAdding;
              if (editingId === item.id) {
                return (
                  <ItemEditor
                    key={item.id}
                    item={item}
                    onSave={(patch) => {
                      onUpdate(item.id, patch);
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                    onDelete={() => {
                      if (window.confirm(`Remove "${item.name}"?`)) {
                        onDelete(item.id);
                        setEditingId(null);
                      }
                    }}
                    isLast={isLast}
                  />
                );
              }
              return (
                <ItemRow
                  key={item.id}
                  item={item}
                  isLast={isLast}
                  onToggle={(c) => onToggle(item.id, c)}
                  onEdit={() => setEditingId(item.id)}
                />
              );
            })}
            {isAdding && (
              <ItemEditor
                isNew
                category={category}
                onSave={(patch) => {
                  onAdd({
                    name: patch.name ?? "",
                    qty: patch.qty,
                    category: patch.category ?? category,
                  });
                }}
                onCancel={onCloseAdd}
                isLast
              />
            )}
            {!isAdding && (
              <button
                type="button"
                onClick={onOpenAdd}
                className="tappable"
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderTop: "1px solid var(--hair)",
                  padding: "10px 18px",
                  textAlign: "left",
                  color: "var(--sumi)",
                  fontSize: 12.5,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icon name="plus" size={13} />
                Add to {category}
              </button>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function ItemRow({
  item,
  isLast,
  onToggle,
  onEdit,
}: {
  item: GroceryItem;
  isLast: boolean;
  onToggle: (c: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <div
      style={{
        padding: "13px 18px",
        borderBottom: isLast ? "none" : "1px solid var(--hair)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <CheckBox
        checked={item.checked}
        onChange={(c) => onToggle(c)}
      />
      <button
        type="button"
        onClick={onEdit}
        className="tappable"
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 13.5,
              color: item.checked ? "var(--muted)" : "var(--ink)",
              fontWeight: 500,
              textDecoration: item.checked ? "line-through" : "none",
              transition: "color 180ms",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.name}
          </span>
          {item.source === "manual" && (
            <span
              style={{
                fontSize: 9.5,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--accent)",
                border: "1px solid var(--accent)",
                borderRadius: 99,
                padding: "1px 6px",
                lineHeight: 1.4,
                flexShrink: 0,
              }}
            >
              Manual
            </span>
          )}
        </div>
        {item.note && (
          <div
            style={{
              fontSize: 11,
              color: "var(--muted)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.note}
          </div>
        )}
      </button>
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
    </div>
  );
}

function ItemEditor({
  item,
  category,
  isNew,
  isLast,
  onSave,
  onCancel,
  onDelete,
}: {
  item?: GroceryItem;
  category?: GroceryCategory;
  isNew?: boolean;
  isLast: boolean;
  onSave: (patch: {
    name?: string;
    qty?: string;
    category?: GroceryCategory;
  }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [qty, setQty] = useState(item?.qty ?? "");
  const [cat, setCat] = useState<GroceryCategory>(
    item?.category ?? category ?? "Other",
  );

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({ name: trimmed, qty: qty.trim(), category: cat });
  }

  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: isLast ? "none" : "1px solid var(--hair)",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 96px",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <input
          autoFocus
          className="field-input"
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            else if (e.key === "Escape") onCancel();
          }}
        />
        <input
          className="field-input"
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            else if (e.key === "Escape") onCancel();
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <select
          className="field-input"
          value={cat}
          onChange={(e) => setCat(e.target.value as GroceryCategory)}
          style={{ flex: "0 1 140px", padding: "6px 10px", fontSize: 12.5 }}
        >
          {GROCERY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        {!isNew && onDelete && (
          <Button
            variant="ghost"
            onClick={onDelete}
            style={{ color: "var(--rose)", padding: "6px 10px" }}
          >
            <Icon name="x" size={13} /> Delete
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={onCancel}
          style={{ padding: "6px 10px" }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!name.trim()}
          style={{ padding: "6px 12px" }}
        >
          {isNew ? "Add" : "Save"}
        </Button>
      </div>
    </div>
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
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-label={checked ? "Mark unchecked" : "Mark checked"}
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
        padding: 0,
        cursor: "pointer",
        transition: "background 180ms, border-color 180ms",
      }}
    >
      {checked && <Icon name="check" size={13} stroke={2.5} />}
    </button>
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
