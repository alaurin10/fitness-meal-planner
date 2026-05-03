import { useCallback, useMemo, useRef, useState } from "react";
import {
  addWeeks,
  localDayKey as sharedLocalDayKey,
  startOfWeek as sharedStartOfWeek,
} from "@platform/shared";
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
  useRebuildGroceries,
  useToggleItem,
  useUpdateGroceryItem,
} from "../hooks/useGroceries";
import { useSettings } from "../hooks/useSettings";
import { useWeekStartDay } from "../hooks/useWeekStartDay";
import {
  GROCERY_CATEGORIES,
  type GroceryCategory,
  type GroceryItem,
} from "../lib/types";
import { formatQuantity, type UnitSystem } from "../lib/units";

export function GroceriesPage() {
  const weekStartDay = useWeekStartDay();
  const now = useMemo(() => new Date(), []);
  const thisWeekStart = useMemo(
    () => sharedLocalDayKey(sharedStartOfWeek(now, weekStartDay)),
    [now, weekStartDay],
  );
  const nextWeekStart = useMemo(
    () => sharedLocalDayKey(addWeeks(sharedStartOfWeek(now, weekStartDay), 1)),
    [now, weekStartDay],
  );
  const [viewingWeekStart, setViewingWeekStart] = useState(thisWeekStart);
  const isCurrentWeek = viewingWeekStart === thisWeekStart;

  const { data: list, isLoading } = useGroceries(viewingWeekStart);
  const toggle = useToggleItem(viewingWeekStart);
  const update = useUpdateGroceryItem(viewingWeekStart);
  const remove = useDeleteGroceryItem(viewingWeekStart);
  const add = useAddGroceryItem(viewingWeekStart);
  const clear = useClearChecked(viewingWeekStart);
  const rebuild = useRebuildGroceries(viewingWeekStart);
  const { data: settings } = useSettings();
  const unitSystem: UnitSystem = settings?.unitSystem ?? "imperial";

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
      <WeekSelector
        viewingWeekStart={viewingWeekStart}
        thisWeekStart={thisWeekStart}
        nextWeekStart={nextWeekStart}
        onChange={setViewingWeekStart}
      />
      <ListBody
        items={items}
        hasList={!!list}
        isCurrentWeek={isCurrentWeek}
        unitSystem={unitSystem}
        onToggle={(id, checked) => toggle.mutate({ itemId: id, checked })}
        onUpdate={(itemId, patch) => update.mutate({ itemId, patch })}
        onDelete={(itemId) => remove.mutate(itemId)}
        onAdd={(input) => add.mutate(input)}
        onClear={() => clear.mutate()}
        onRebuild={() => rebuild.mutate()}
        rebuilding={rebuild.isPending}
      />
    </Layout>
  );
}

function WeekSelector({
  viewingWeekStart,
  thisWeekStart,
  nextWeekStart,
  onChange,
}: {
  viewingWeekStart: string;
  thisWeekStart: string;
  nextWeekStart: string;
  onChange: (week: string) => void;
}) {
  return (
    <div className="px-4 pt-3 pb-1">
      <div
        style={{
          display: "inline-flex",
          background: "var(--bg)",
          borderRadius: 999,
          padding: 3,
          gap: 2,
          border: "1px solid var(--hair)",
        }}
      >
        {(
          [
            { key: thisWeekStart, label: "This week" },
            { key: nextWeekStart, label: "Next week" },
          ] as const
        ).map((opt) => {
          const active = viewingWeekStart === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className="tappable"
              style={{
                padding: "6px 14px",
                border: "none",
                background: active ? "var(--ink)" : "transparent",
                color: active ? "var(--paper)" : "var(--sumi)",
                borderRadius: 999,
                fontFamily: "var(--font-body)",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ListBodyProps {
  items: GroceryItem[];
  hasList: boolean;
  isCurrentWeek: boolean;
  unitSystem: UnitSystem;
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
  onRebuild: () => void;
  rebuilding: boolean;
}

function ListBody({
  items,
  hasList,
  isCurrentWeek,
  unitSystem,
  onToggle,
  onUpdate,
  onDelete,
  onAdd,
  onClear,
  onRebuild,
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
  // null/undefined ⇒ let the server auto-categorize from the name.
  const [quickAddCategory, setQuickAddCategory] = useState<
    GroceryCategory | "auto"
  >("auto");
  const [quickAddFocused, setQuickAddFocused] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFocus = useCallback(() => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setQuickAddFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    blurTimeout.current = setTimeout(() => setQuickAddFocused(false), 150);
  }, []);

  function handleQuickAdd() {
    const name = quickAddName.trim();
    if (!name) return;
    onAdd({
      name,
      qty: quickAddQty.trim() || undefined,
      category:
        quickAddCategory === "auto" ? undefined : quickAddCategory,
    });
    setQuickAddName("");
    setQuickAddQty("");
    // Keep the category sticky — likely the user is adding multiple
    // items of the same kind in a row.
  }

  return (
    <>
      <PhoneHeader
        title="Market"
        subtitle={
          total > 0
            ? `${total - checked} items left for ${isCurrentWeek ? "this week" : "next week"}.`
            : hasList
              ? "Empty list — add items below or rebuild from your plan."
              : isCurrentWeek
                ? "Generate a meal plan, or just start adding items."
                : "No items yet for next week — rebuild from your plan or add manually."
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
          onClick={onRebuild}
          disabled={rebuilding}
          className="w-full"
          title="Rebuild auto items from your current meal plan"
        >
          <Icon name="sparkle" size={14} />
          {rebuilding ? "Rebuilding…" : "Rebuild from plan"}
        </Button>
      </div>

      {/* Quick add — pick a category, or let the server auto-sort. */}
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
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
            <input
              className="field-input"
              placeholder="Qty"
              value={quickAddQty}
              onChange={(e) => setQuickAddQty(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQuickAdd();
              }}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
            <Button
              onClick={handleQuickAdd}
              disabled={!quickAddName.trim()}
              style={{ padding: "8px 12px" }}
              title="Add to grocery list"
            >
              <Icon name="plus" size={13} />
            </Button>
          </div>
          {quickAddFocused && (
            <div
              style={{
                padding: "0 12px 10px",
                display: "flex",
                gap: 4,
                flexWrap: "wrap",
              }}
            >
              <CategoryChip
                active={quickAddCategory === "auto"}
                onClick={() => setQuickAddCategory("auto")}
              >
                Auto
              </CategoryChip>
              {GROCERY_CATEGORIES.map((c) => (
                <CategoryChip
                  key={c}
                  active={quickAddCategory === c}
                  onClick={() => setQuickAddCategory(c)}
                >
                  {c}
                </CategoryChip>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Categories — single column on every breakpoint, since varying
          category lengths leave awkward gaps in a grid. */}
      <div className="pt-1 md:max-w-[640px] md:mx-auto">
        {GROCERY_CATEGORIES.map((category) => {
          const entries = byCategory[category] ?? [];
          // Always show category if it has items OR if it's the one being added to.
          if (entries.length === 0 && openAdd !== category) return null;
          return (
            <CategorySection
              key={category}
              category={category}
              items={entries}
              unitSystem={unitSystem}
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
  unitSystem: UnitSystem;
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
  unitSystem,
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
    <div>
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
                  unitSystem={unitSystem}
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
    </div>
  );
}

function ItemRow({
  item,
  isLast,
  unitSystem,
  onToggle,
  onEdit,
}: {
  item: GroceryItem;
  isLast: boolean;
  unitSystem: UnitSystem;
  onToggle: (c: boolean) => void;
  onEdit: () => void;
}) {
  const [qtyExpanded, setQtyExpanded] = useState(false);
  // If the item has structured amount/unit, use formatQuantity for unit conversion.
  // Otherwise fall back to the pre-formatted qty string.
  const displayQty =
    item.amount != null && item.unit != null
      ? formatQuantity({ amount: item.amount, unit: item.unit }, unitSystem)
      : item.qty;
  const isLongQty = !!displayQty && displayQty.length > 20;
  // Whole row is the toggle target — much easier to tap. Edit moves to
  // a small icon button on the right; clicks there stop propagation so
  // they don't also flip the checkbox.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onToggle(!item.checked)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle(!item.checked);
        }
      }}
      className="tappable"
      style={{
        padding: "13px 14px 13px 18px",
        borderBottom: isLast ? "none" : "1px solid var(--hair)",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <CheckBoxVisual checked={item.checked} style={{ marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
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
        {displayQty && (
          <div
            onClick={
              isLongQty
                ? (e) => {
                    e.stopPropagation();
                    setQtyExpanded((v) => !v);
                  }
                : undefined
            }
            style={{
              fontSize: 11.5,
              color: "var(--muted)",
              letterSpacing: "0.03em",
              fontFamily: "var(--font-mono)",
              marginTop: 2,
              cursor: isLongQty ? "pointer" : "default",
              ...(isLongQty && !qtyExpanded
                ? {
                    overflow: "hidden" as const,
                    textOverflow: "ellipsis" as const,
                    whiteSpace: "nowrap" as const,
                  }
                : { wordBreak: "break-word" as const }),
            }}
          >
            {displayQty}
            {isLongQty && !qtyExpanded && (
              <span style={{ marginLeft: 4, fontSize: 10, color: "var(--accent)" }}>▸ more</span>
            )}
          </div>
        )}
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
      </div>
      <button
        type="button"
        aria-label={`Edit ${item.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="tappable"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--muted)",
          padding: 6,
          marginLeft: 2,
          marginRight: -2,
          borderRadius: 8,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="ellipsis" size={16} />
      </button>
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

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tappable"
      style={{
        border: "1px solid " + (active ? "var(--ink)" : "var(--hair)"),
        background: active ? "var(--ink)" : "var(--paper)",
        color: active ? "var(--paper)" : "var(--sumi)",
        padding: "5px 10px",
        borderRadius: 999,
        fontFamily: "var(--font-body)",
        fontSize: 11.5,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function CheckBoxVisual({ checked, style: extraStyle }: { checked: boolean; style?: React.CSSProperties }) {
  // Pure visual — the row's role="button" handles toggling.
  return (
    <span
      aria-hidden
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
        ...extraStyle,
      }}
    >
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
  // Push checked items to the bottom of each category while preserving
  // the relative order within each group (stable sort).
  for (const cat of GROCERY_CATEGORIES) {
    out[cat].sort((a, b) => Number(a.checked) - Number(b.checked));
  }
  return out;
}
