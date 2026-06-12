import { useEffect, useMemo, useState } from "react";
import {
  addWeeks,
  localDayKey as sharedLocalDayKey,
  startOfWeek as sharedStartOfWeek,
} from "@platform/shared";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { useConfirm } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { GeneratingProgress } from "../components/GeneratingProgress";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { PhoneHeader } from "../components/Primitives";
import { Sheet } from "../components/Sheet";
import { SkeletonList } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { WeekSelector } from "../components/WeekSelector";
import { tap } from "../lib/haptics";
import {
  useAddGroceryItem,
  useClearChecked,
  useDeleteGroceryItem,
  useGroceries,
  useRebuildGroceries,
  useToggleItem,
  useUpdateGroceryItem,
} from "../hooks/useGroceries";
import { useGenerateMealPlan } from "../hooks/useMealPlan";
import { useSettings } from "../hooks/useSettings";
import { useWeekStartDay } from "../hooks/useWeekStartDay";
import {
  GROCERY_CATEGORIES,
  type GroceryCategory,
  type GroceryItem,
} from "../lib/types";
import { formatQuantity, type UnitSystem } from "../lib/units";

// Tighter padding/gap so the three actions fit one row on a narrow phone.
const ACTION_BTN: React.CSSProperties = {
  padding: "11px 8px",
  gap: 6,
  whiteSpace: "nowrap",
};

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
  const generate = useGenerateMealPlan();
  const { data: settings } = useSettings();
  const unitSystem: UnitSystem = settings?.unitSystem ?? "imperial";
  const toast = useToast();

  if (isLoading) {
    return (
      <Layout>
        <div className="px-4 py-4">
          <SkeletonList count={4} />
        </div>
      </Layout>
    );
  }

  const items = list?.items ?? [];

  return (
    <Layout>
      <ListBody
        viewingWeekStart={viewingWeekStart}
        thisWeekStart={thisWeekStart}
        nextWeekStart={nextWeekStart}
        onWeekChange={setViewingWeekStart}
        items={items}
        hasList={!!list}
        isCurrentWeek={isCurrentWeek}
        unitSystem={unitSystem}
        onToggle={(id, checked) => {
          tap();
          toggle.mutate({ itemId: id, checked });
        }}
        onUpdate={(itemId, patch) => update.mutate({ itemId, patch })}
        onDelete={(itemId) => remove.mutate(itemId)}
        onAdd={(input) =>
          add.mutate(input, {
            onError: (e) => toast.error((e as Error).message),
          })
        }
        onClear={() => {
          const count = items.filter((i) => i.checked).length;
          clear.mutate(undefined, {
            onSuccess: () =>
              toast.success(`Cleared ${count} item${count === 1 ? "" : "s"}`),
            onError: (e) => toast.error((e as Error).message),
          });
        }}
        onRebuild={() =>
          rebuild.mutate(undefined, {
            onSuccess: () => toast.success("List rebuilt from your meal plan"),
            onError: (e) => toast.error((e as Error).message),
          })
        }
        rebuilding={rebuild.isPending}
        onGeneratePlan={() =>
          generate.mutate({ targetWeekStart: viewingWeekStart })
        }
        generating={generate.isPending}
        generateError={generate.error as Error | null}
      />
    </Layout>
  );
}

interface ListBodyProps {
  viewingWeekStart: string;
  thisWeekStart: string;
  nextWeekStart: string;
  onWeekChange: (week: string) => void;
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
  onGeneratePlan: () => void;
  generating: boolean;
  generateError: Error | null;
}

function ListBody({
  viewingWeekStart,
  thisWeekStart,
  nextWeekStart,
  onWeekChange,
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
  onGeneratePlan,
  generating,
  generateError,
}: ListBodyProps) {
  const byCategory = useMemo(() => groupByCategory(items), [items]);
  // Categories that still have unchecked items come first (in canonical
  // order); fully-completed categories sort to the bottom so they don't sit
  // between the lists the shopper is still working through.
  const orderedCategories = useMemo(() => {
    const withItems = GROCERY_CATEGORIES.filter(
      (c) => (byCategory[c]?.length ?? 0) > 0,
    );
    const isComplete = (c: GroceryCategory) =>
      byCategory[c]!.every((i) => i.checked);
    return [
      ...withItems.filter((c) => !isComplete(c)),
      ...withItems.filter((c) => isComplete(c)),
    ];
  }, [byCategory]);
  const total = items.length;
  const checked = items.filter((i) => i.checked).length;
  const hasChecked = checked > 0;
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <PhoneHeader
        title="Market"
        subtitle={
          total > 0
            ? undefined
            : hasList
              ? "Your list is empty."
              : "No list yet."
        }
        right={
          <WeekSelector
            viewingWeekStart={viewingWeekStart}
            thisWeekStart={thisWeekStart}
            nextWeekStart={nextWeekStart}
            onChange={onWeekChange}
          />
        }
      />

      {!hasList && (
        <div className="px-4 pt-2">
          {generating ? (
            <GeneratingProgress kind="meal" estimatedSeconds={60} />
          ) : (
            <EmptyState
              icon="groceries"
              title={isCurrentWeek ? "No plan for this week" : "No plan for next week"}
              body="Generate the plan to auto-build the grocery list."
            >
              <Button className="w-full mt-4" onClick={onGeneratePlan}>
                <Icon name="sparkle" size={16} />
                {isCurrentWeek ? "Generate this week" : "Generate next week"}
              </Button>
              {generateError && (
                <p style={{ color: "var(--rose)", fontSize: 12.5, marginTop: 12 }}>
                  {generateError.message}
                </p>
              )}
            </EmptyState>
          )}
        </div>
      )}

      {hasList && (
        <>
          {total > 0 && <ListProgress checked={checked} total={total} />}

          {/* Compact actions: add (primary) + secondary list ops, one row. */}
          <div className="px-4 pt-3 md:max-w-[640px] md:mx-auto grid grid-cols-3 gap-2">
            <Button
              className="w-full"
              onClick={() => setAddOpen(true)}
              title="Add an item"
              style={ACTION_BTN}
            >
              <Icon name="plus" size={14} /> Add
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              onClick={onClear}
              disabled={!hasChecked}
              title="Clear checked items"
              style={ACTION_BTN}
            >
              <Icon name="check" size={14} /> Clear
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              onClick={onRebuild}
              disabled={rebuilding}
              title="Rebuild from your meal plan"
              style={ACTION_BTN}
            >
              <Icon name="sparkle" size={14} /> Rebuild
            </Button>
          </div>

          {total === 0 ? (
            <div className="px-4 pt-4 md:max-w-[640px] md:mx-auto">
              <Card>
                <div style={{ fontSize: 13.5, color: "var(--sumi)", lineHeight: 1.5 }}>
                  Your list is empty. Add an item above, or rebuild it from your meal plan.
                </div>
              </Card>
            </div>
          ) : (
            // Single column on every breakpoint — varying category lengths
            // leave awkward gaps in a grid.
            <div className="pt-1 md:max-w-[640px] md:mx-auto">
              {orderedCategories.map((category) => {
                const entries = byCategory[category] ?? [];
                const complete = entries.every((i) => i.checked);
                return (
                  <CategorySection
                    key={category}
                    category={category}
                    items={entries}
                    complete={complete}
                    unitSystem={unitSystem}
                    onToggle={onToggle}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                );
              })}
            </div>
          )}

          <AddItemSheet
            open={addOpen}
            onClose={() => setAddOpen(false)}
            onAdd={onAdd}
          />
        </>
      )}
    </>
  );
}

function ListProgress({ checked, total }: { checked: number; total: number }) {
  const pct = total > 0 ? checked / total : 0;
  return (
    // Sticky under the mobile header so progress stays visible while
    // working down a long list.
    <div
      className="px-4 pt-2 pb-2 sticky top-[52px] md:top-0 z-[5] md:max-w-[640px] md:mx-auto"
      style={{
        background: "color-mix(in srgb, var(--bg) 88%, transparent)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 12.5, color: "var(--sumi)" }}>
          {checked} of {total} gathered
        </span>
        <span style={{ fontSize: 11.5, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
          {Math.round(pct * 100)}%
        </span>
      </div>
      <div
        aria-hidden
        style={{
          height: 6,
          borderRadius: 99,
          background: "color-mix(in srgb, var(--muted) 18%, transparent)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background: "var(--moss)",
            borderRadius: 99,
            transition: "width 320ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />
      </div>
    </div>
  );
}

function AddItemSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (input: {
    name: string;
    qty?: string;
    category?: GroceryCategory;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  // "auto" ⇒ let the server categorize from the name.
  const [category, setCategory] = useState<GroceryCategory | "auto">("auto");

  // Start each session with empty name/qty; keep the category sticky.
  useEffect(() => {
    if (open) {
      setName("");
      setQty("");
    }
  }, [open]);

  function submit() {
    const n = name.trim();
    if (!n) return;
    onAdd({
      name: n,
      qty: qty.trim() || undefined,
      category: category === "auto" ? undefined : category,
    });
    // Keep the sheet open for fast multi-add; reset just the item fields.
    setName("");
    setQty("");
  }

  return (
    // Centered popup (not a bottom sheet) so the on-screen keyboard
    // doesn't push it up and down.
    <Sheet open={open} onClose={onClose} aria-label="Add item" position="center">
      <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div className="font-display" style={{ fontSize: 20, color: "var(--ink)" }}>
            Add item
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--sumi)",
              cursor: "pointer",
              padding: 6,
            }}
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 96px",
            gap: 6,
          }}
        >
          <input
            data-autofocus
            className="field-input"
            placeholder="e.g. avocado"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          <input
            className="field-input"
            placeholder="Qty"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 10 }}>
          <CategoryChip active={category === "auto"} onClick={() => setCategory("auto")}>
            Auto
          </CategoryChip>
          {GROCERY_CATEGORIES.map((c) => (
            <CategoryChip key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </CategoryChip>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Done
          </Button>
          <Button className="flex-1" onClick={submit} disabled={!name.trim()}>
            <Icon name="plus" size={14} /> Add
          </Button>
        </div>
      </>
    </Sheet>
  );
}

interface CategorySectionProps {
  category: GroceryCategory;
  items: GroceryItem[];
  complete: boolean;
  unitSystem: UnitSystem;
  onToggle: (id: string, checked: boolean) => void;
  onUpdate: (
    itemId: string,
    patch: { name?: string; qty?: string; category?: GroceryCategory },
  ) => void;
  onDelete: (itemId: string) => void;
}

function CategorySection({
  category,
  items,
  complete,
  unitSystem,
  onToggle,
  onUpdate,
  onDelete,
}: CategorySectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const remaining = items.filter((i) => !i.checked).length;
  return (
    <div style={{ opacity: complete ? 0.5 : 1, transition: "opacity 220ms ease" }}>
      {confirmDialog}
      <div className="px-6 pt-4 pb-2">
        <button
          type="button"
          className="tappable flex w-full items-center justify-between"
          onClick={() => setCollapsed((c) => !c)}
          style={{ background: "none", border: "none", padding: 0 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="eyebrow">{category}</div>
            {complete ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 11,
                  color: "var(--moss)",
                }}
              >
                <Icon name="check" size={12} stroke={2.5} /> Done
              </span>
            ) : (
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {`${remaining} / ${items.length}`}
              </span>
            )}
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
      {/* Always rendered so collapse can animate; visibility is delayed past
          the fold on close, then removes rows from tab order / a11y tree. */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: collapsed ? "0fr" : "1fr",
          opacity: collapsed ? 0 : 1,
          visibility: collapsed ? "hidden" : "visible",
          transition: `grid-template-rows 260ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms ease, visibility 0s linear ${collapsed ? "260ms" : "0s"}`,
        }}
      >
        {/* minHeight: 0 is required — grid items default to min-height: auto
            and the 0fr row would never actually collapse. */}
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div className="px-4">
            <Card flush>
              {items.map((item, i) => {
                const isLast = i === items.length - 1;
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
                      onDelete={async () => {
                        const ok = await confirm({
                          title: `Remove "${item.name}"?`,
                          confirmLabel: "Remove",
                          destructive: true,
                        });
                        if (ok) {
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
            </Card>
          </div>
        </div>
      </div>
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
      // Only freshly added (optimistic temp-id) rows animate in: the server
      // remount under the real id and plain page loads render statically.
      className={item.id.startsWith("temp-") ? "tappable fade-up" : "tappable"}
      style={{
        padding: "13px 14px 13px 18px",
        borderBottom: isLast ? "none" : "1px solid var(--hair)",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        cursor: "pointer",
        userSelect: "none",
        animationDuration: "240ms",
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
      {checked && (
        <span className="check-pop" style={{ display: "inline-flex" }}>
          <Icon name="check" size={13} stroke={2.5} />
        </span>
      )}
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
