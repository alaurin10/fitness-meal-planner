import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { Layout } from "../components/Layout";
import { PhoneHeader } from "../components/Primitives";
import {
  useCreateRecipe,
  useRecipe,
  useUpdateRecipe,
} from "../hooks/useRecipes";
import {
  GROCERY_CATEGORIES,
  MEAL_SLOTS,
  RECIPE_CATEGORIES,
  type GroceryCategory,
  type Ingredient,
  type MealSlot,
  type RecipeCategory,
  type RecipeInput,
  type RecipeStep,
} from "../lib/types";

const RECIPE_CATEGORY_LABELS: Record<RecipeCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  dessert: "Dessert",
  baking: "Baking",
  drinks: "Drinks",
  sides: "Sides",
  other: "Other",
};

const UNIT_OPTIONS = [
  "g",
  "kg",
  "oz",
  "lb",
  "ml",
  "L",
  "tsp",
  "tbsp",
  "cup",
  "fl oz",
  "piece",
  "slice",
  "clove",
  "can",
  "pinch",
  "to taste",
  "",
];

interface FormState {
  name: string;
  slotHint: MealSlot | "";
  category: RecipeCategory;
  servings: number;
  prepMinutes: string;
  cookMinutes: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  tags: string;
  notes: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
}

const EMPTY_FORM: FormState = {
  name: "",
  slotHint: "",
  category: "other",
  servings: 1,
  prepMinutes: "",
  cookMinutes: "",
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  tags: "",
  notes: "",
  ingredients: [
    { name: "", quantity: { amount: 1, unit: "" }, category: "Other" },
  ],
  steps: [{ order: 1, text: "" }],
};

export function RecipeEditorPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const isEdit = !!params.id;
  const { data: existing, isLoading } = useRecipe(isEdit ? params.id : undefined);
  const create = useCreateRecipe();
  const update = useUpdateRecipe();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.name,
      slotHint: existing.slotHint ?? "",
      category: existing.category ?? "other",
      servings: existing.servings,
      prepMinutes: existing.prepMinutes?.toString() ?? "",
      cookMinutes: existing.cookMinutes?.toString() ?? "",
      calories: existing.calories.toString(),
      proteinG: existing.proteinG.toString(),
      carbsG: existing.carbsG?.toString() ?? "",
      fatG: existing.fatG?.toString() ?? "",
      tags: existing.tags.join(", "),
      notes: existing.notes ?? "",
      ingredients:
        existing.ingredientsJson.length > 0
          ? existing.ingredientsJson
          : EMPTY_FORM.ingredients,
      steps:
        existing.stepsJson.length > 0
          ? existing.stepsJson
          : EMPTY_FORM.steps,
    });
  }, [existing]);

  if (isEdit && isLoading) {
    return (
      <Layout>
        <div className="px-4 py-4">
          <Card>Loading…</Card>
        </div>
      </Layout>
    );
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addIngredient() {
    setForm((f) => ({
      ...f,
      ingredients: [
        ...f.ingredients,
        { name: "", quantity: { amount: 1, unit: "" }, category: "Other" },
      ],
    }));
  }
  function removeIngredient(idx: number) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.filter((_, i) => i !== idx),
    }));
  }
  function updateIngredient(idx: number, patch: Partial<Ingredient>) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((ing, i) =>
        i === idx ? { ...ing, ...patch } : ing,
      ),
    }));
  }
  function updateIngredientQty(
    idx: number,
    patch: Partial<Ingredient["quantity"]>,
  ) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((ing, i) =>
        i === idx ? { ...ing, quantity: { ...ing.quantity, ...patch } } : ing,
      ),
    }));
  }

  function addStep() {
    setForm((f) => ({
      ...f,
      steps: [...f.steps, { order: f.steps.length + 1, text: "" }],
    }));
  }
  function removeStep(idx: number) {
    setForm((f) => {
      const next = f.steps.filter((_, i) => i !== idx);
      return { ...f, steps: next.map((s, i) => ({ ...s, order: i + 1 })) };
    });
  }
  function updateStep(idx: number, patch: Partial<RecipeStep>) {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }
  function moveStep(idx: number, dir: -1 | 1) {
    setForm((f) => {
      const next = [...f.steps];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return f;
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      return { ...f, steps: next.map((s, i) => ({ ...s, order: i + 1 })) };
    });
  }

  async function onSubmit() {
    setError(null);
    if (!form.name.trim()) {
      setError("Recipe name is required.");
      return;
    }
    const calories = Number(form.calories);
    const proteinG = Number(form.proteinG);
    if (!Number.isFinite(calories) || calories <= 0) {
      setError("Calories must be a positive number.");
      return;
    }
    if (!Number.isFinite(proteinG) || proteinG < 0) {
      setError("Protein must be a non-negative number.");
      return;
    }
    const cleanIngredients = form.ingredients
      .filter((i) => i.name.trim().length > 0)
      .map((i) => ({
        name: i.name.trim(),
        quantity: {
          amount: Number.isFinite(i.quantity.amount) ? i.quantity.amount : 0,
          unit: i.quantity.unit,
        },
        category: i.category,
        note: i.note?.trim() || undefined,
      }));
    if (cleanIngredients.length === 0) {
      setError("Add at least one ingredient.");
      return;
    }
    const cleanSteps = form.steps
      .filter((s) => s.text.trim().length > 0)
      .map((s, i) => ({
        order: i + 1,
        text: s.text.trim(),
        durationMinutes: s.durationMinutes,
      }));
    if (cleanSteps.length === 0) {
      setError("Add at least one step.");
      return;
    }

    const input: RecipeInput = {
      name: form.name.trim(),
      slotHint: form.slotHint || null,
      category: form.category,
      servings: Math.max(1, Math.round(form.servings)),
      prepMinutes: form.prepMinutes ? Number(form.prepMinutes) : null,
      cookMinutes: form.cookMinutes ? Number(form.cookMinutes) : null,
      calories,
      proteinG,
      carbsG: form.carbsG ? Number(form.carbsG) : null,
      fatG: form.fatG ? Number(form.fatG) : null,
      ingredients: cleanIngredients,
      steps: cleanSteps,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: form.notes.trim() || null,
    };

    try {
      if (isEdit && params.id) {
        await update.mutateAsync({ id: params.id, input });
        navigate(`/recipes/${params.id}`);
      } else {
        const created = await create.mutateAsync(input);
        navigate(`/recipes/${created.id}`);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Layout>
      <div style={{ padding: "8px 16px 0" }}>
        <Button
          variant="plain"
          onClick={() => navigate(-1)}
          style={{ paddingLeft: 0 }}
        >
          <Icon name="chevron" size={16} style={{ transform: "rotate(180deg)" }} />
          Back
        </Button>
      </div>
      <PhoneHeader title={isEdit ? "Edit recipe" : "New recipe"} />

      <div className="px-4 pt-2 space-y-3">
        <Card>
          <Field label="Name">
            <input
              className="field-input"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Sheet-pan chicken & broccoli"
            />
          </Field>
          <Row>
            <Field label="Category">
              <select
                className="field-input"
                value={form.category}
                onChange={(e) =>
                  setField("category", e.target.value as RecipeCategory)
                }
              >
                {RECIPE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {RECIPE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Slot">
              <select
                className="field-input"
                value={form.slotHint}
                onChange={(e) =>
                  setField("slotHint", e.target.value as MealSlot | "")
                }
              >
                <option value="">—</option>
                {MEAL_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="Servings">
              <input
                type="number"
                min={1}
                className="field-input"
                value={form.servings}
                onChange={(e) => setField("servings", Number(e.target.value))}
              />
            </Field>
          </Row>
          <Row>
            <Field label="Prep (min)">
              <input
                type="number"
                min={0}
                className="field-input"
                value={form.prepMinutes}
                onChange={(e) => setField("prepMinutes", e.target.value)}
              />
            </Field>
            <Field label="Cook (min)">
              <input
                type="number"
                min={0}
                className="field-input"
                value={form.cookMinutes}
                onChange={(e) => setField("cookMinutes", e.target.value)}
              />
            </Field>
          </Row>
        </Card>

        <Card>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Per serving macros
          </div>
          <Row>
            <Field label="Calories">
              <input
                type="number"
                min={0}
                className="field-input"
                value={form.calories}
                onChange={(e) => setField("calories", e.target.value)}
              />
            </Field>
            <Field label="Protein (g)">
              <input
                type="number"
                min={0}
                className="field-input"
                value={form.proteinG}
                onChange={(e) => setField("proteinG", e.target.value)}
              />
            </Field>
          </Row>
          <Row>
            <Field label="Carbs (g)">
              <input
                type="number"
                min={0}
                className="field-input"
                value={form.carbsG}
                onChange={(e) => setField("carbsG", e.target.value)}
              />
            </Field>
            <Field label="Fat (g)">
              <input
                type="number"
                min={0}
                className="field-input"
                value={form.fatG}
                onChange={(e) => setField("fatG", e.target.value)}
              />
            </Field>
          </Row>
        </Card>

        <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div className="eyebrow">Ingredients</div>
            <Button variant="plain" onClick={addIngredient}>
              <Icon name="plus" size={14} />
              Add
            </Button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {form.ingredients.map((ing, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 70px 1fr 28px",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="field-input"
                  style={{ padding: "8px 10px", fontSize: 13 }}
                  value={ing.quantity.amount}
                  onChange={(e) =>
                    updateIngredientQty(i, { amount: Number(e.target.value) })
                  }
                />
                <select
                  className="field-input"
                  style={{ padding: "8px 6px", fontSize: 12 }}
                  value={ing.quantity.unit}
                  onChange={(e) =>
                    updateIngredientQty(i, { unit: e.target.value })
                  }
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u || "—"} value={u}>
                      {u || "—"}
                    </option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
                  <input
                    className="field-input"
                    style={{ padding: "8px 10px", fontSize: 13 }}
                    placeholder="Ingredient name"
                    value={ing.name}
                    onChange={(e) =>
                      updateIngredient(i, { name: e.target.value })
                    }
                  />
                  <select
                    className="field-input"
                    style={{ padding: "6px 8px", fontSize: 11.5 }}
                    value={ing.category ?? "Other"}
                    onChange={(e) =>
                      updateIngredient(i, {
                        category: e.target.value as GroceryCategory,
                      })
                    }
                  >
                    {GROCERY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeIngredient(i)}
                  aria-label="Remove ingredient"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--muted)",
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div className="eyebrow">Steps</div>
            <Button variant="plain" onClick={addStep}>
              <Icon name="plus" size={14} />
              Add
            </Button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {form.steps.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr 60px 28px",
                  gap: 6,
                  alignItems: "start",
                }}
              >
                <div
                  className="font-display"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--clay)",
                    color: "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  {s.order}
                </div>
                <textarea
                  className="field-input"
                  style={{ padding: "8px 10px", fontSize: 13, minHeight: 56 }}
                  placeholder="Step instructions"
                  value={s.text}
                  onChange={(e) => updateStep(i, { text: e.target.value })}
                />
                <input
                  type="number"
                  min={0}
                  placeholder="min"
                  className="field-input"
                  style={{ padding: "8px 8px", fontSize: 12 }}
                  value={s.durationMinutes ?? ""}
                  onChange={(e) =>
                    updateStep(i, {
                      durationMinutes: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => moveStep(i, -1)}
                    disabled={i === 0}
                    aria-label="Move step up"
                    style={iconBtnStyle}
                  >
                    <Icon
                      name="chevron"
                      size={12}
                      style={{ transform: "rotate(-90deg)" }}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStep(i, 1)}
                    disabled={i === form.steps.length - 1}
                    aria-label="Move step down"
                    style={iconBtnStyle}
                  >
                    <Icon
                      name="chevron"
                      size={12}
                      style={{ transform: "rotate(90deg)" }}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    aria-label="Remove step"
                    style={iconBtnStyle}
                  >
                    <Icon name="x" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        </div>

        <Card>
          <Field label="Tags (comma separated)">
            <input
              className="field-input"
              value={form.tags}
              onChange={(e) => setField("tags", e.target.value)}
              placeholder="high-protein, one-pan"
            />
          </Field>
          <Field label="Notes">
            <textarea
              className="field-input"
              style={{ minHeight: 70 }}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Optional notes, substitutions, sources…"
            />
          </Field>
        </Card>

        {error && (
          <div
            style={{
              color: "var(--rose)",
              fontSize: 13,
              padding: "0 4px",
            }}
          >
            {error}
          </div>
        )}

        <Button
          variant="accent"
          className="w-full"
          onClick={onSubmit}
          disabled={create.isPending || update.isPending}
        >
          <Icon name="check" size={16} />
          {create.isPending || update.isPending
            ? "Saving…"
            : isEdit
              ? "Save changes"
              : "Create recipe"}
        </Button>
      </div>
    </Layout>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--hair)",
  borderRadius: 6,
  color: "var(--muted)",
  cursor: "pointer",
  padding: 3,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        marginBottom: 10,
        flex: 1,
      }}
    >
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 0 }}>{children}</div>
  );
}
