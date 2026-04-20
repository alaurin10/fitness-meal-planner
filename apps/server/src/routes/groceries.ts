import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  prisma,
  Prisma,
  GROCERY_CATEGORIES,
  type GroceryItem,
} from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import { buildGroceryItems } from "../services/groceryAggregator.js";
import {
  classifyCategoryForUser,
  learnCategory,
} from "../services/groceryCategorizer.js";
import { mergeGroceryItems } from "../services/groceryMerge.js";
import { normalizeMealPlan } from "../services/mealPlanNormalizer.js";

const router = Router();

const patchSchema = z
  .object({
    checked: z.boolean().optional(),
    name: z.string().min(1).max(120).optional(),
    qty: z.string().max(80).optional(),
    category: z.enum(GROCERY_CATEGORIES).optional(),
    note: z.string().max(200).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field is required",
  });

const createSchema = z.object({
  name: z.string().min(1).max(120),
  qty: z.string().max(80).optional().default(""),
  // Optional: when omitted, the server classifies from the item name.
  category: z.enum(GROCERY_CATEGORIES).optional(),
  note: z.string().max(200).optional(),
});

async function findCurrentList(userId: string) {
  return prisma.groceryList.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

function readItems(raw: unknown): GroceryItem[] {
  return Array.isArray(raw) ? (raw as GroceryItem[]) : [];
}

function toJson(items: GroceryItem[]): Prisma.InputJsonValue {
  return items as unknown as Prisma.InputJsonValue;
}

function sortItems(items: GroceryItem[]): GroceryItem[] {
  return [...items].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
}

router.get("/current", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const list = await findCurrentList(userId);
  res.json({ list });
});

router.post("/items", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  let list = await findCurrentList(userId);
  if (!list) {
    // Allow adding manual items even before any plan exists.
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });
    list = await prisma.groceryList.create({
      data: {
        userId,
        weeklyMealPlanId: null,
        items: toJson([]),
      },
    });
  }
  const trimmedName = parsed.data.name.trim();
  const resolvedCategory =
    parsed.data.category ?? (await classifyCategoryForUser(userId, trimmedName));
  const newItem: GroceryItem = {
    id: randomUUID(),
    name: trimmedName,
    qty: (parsed.data.qty ?? "").trim(),
    category: resolvedCategory,
    checked: false,
    pushed: false,
    source: "manual",
    note: parsed.data.note?.trim() || undefined,
  };
  // If the user explicitly chose a category, learn it for next time.
  if (parsed.data.category) {
    await learnCategory(userId, trimmedName, parsed.data.category);
  }
  const items = sortItems([...readItems(list.items), newItem]);
  const updated = await prisma.groceryList.update({
    where: { id: list.id },
    data: { items: toJson(items) },
  });
  res.json({ list: updated, item: newItem });
});

router.patch("/items/:itemId", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const list = await findCurrentList(userId);
  if (!list) {
    res.status(404).json({ error: "No grocery list" });
    return;
  }
  const id = String(req.params.itemId);
  let touched = false;
  const next = readItems(list.items).map((item) => {
    if (item.id !== id) return item;
    touched = true;
    return {
      ...item,
      ...(parsed.data.checked !== undefined && { checked: parsed.data.checked }),
      ...(parsed.data.name !== undefined && { name: parsed.data.name.trim() }),
      ...(parsed.data.qty !== undefined && { qty: parsed.data.qty.trim() }),
      ...(parsed.data.category !== undefined && {
        category: parsed.data.category,
      }),
      ...(parsed.data.note !== undefined && {
        note: parsed.data.note.trim() || undefined,
      }),
    };
  });
  if (!touched) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  // When the user explicitly changes the category, remember it so the same
  // item name gets auto-sorted correctly next time.
  if (parsed.data.category) {
    const editedItem = next.find((i) => i.id === id);
    if (editedItem) {
      await learnCategory(userId, editedItem.name, parsed.data.category);
    }
  }
  const updated = await prisma.groceryList.update({
    where: { id: list.id },
    data: { items: toJson(sortItems(next)) },
  });
  res.json({ list: updated });
});

router.delete("/items/:itemId", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const list = await findCurrentList(userId);
  if (!list) {
    res.status(404).json({ error: "No grocery list" });
    return;
  }
  const id = String(req.params.itemId);
  const next = readItems(list.items).filter((i) => i.id !== id);
  const updated = await prisma.groceryList.update({
    where: { id: list.id },
    data: { items: toJson(next) },
  });
  res.json({ list: updated });
});

router.post("/rebuild", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const list = await findCurrentList(userId);
  if (!list) {
    res.status(404).json({ error: "No grocery list" });
    return;
  }
  const plan = list.weeklyMealPlanId
    ? await prisma.weeklyMealPlan.findFirst({
        where: { id: list.weeklyMealPlanId, userId },
      })
    : await prisma.weeklyMealPlan.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: "desc" },
      });
  const fresh: GroceryItem[] = plan
    ? buildGroceryItems(normalizeMealPlan(plan.planJson))
    : [];
  const merged = mergeGroceryItems(fresh, readItems(list.items));
  const updated = await prisma.groceryList.update({
    where: { id: list.id },
    data: { items: toJson(merged) },
  });
  res.json({ list: updated });
});

router.post("/clear-checked", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const list = await findCurrentList(userId);
  if (!list) {
    res.status(404).json({ error: "No grocery list" });
    return;
  }
  const items = readItems(list.items).filter((i) => !i.checked);
  const updated = await prisma.groceryList.update({
    where: { id: list.id },
    data: { items: toJson(items) },
  });
  res.json({ list: updated });
});

router.post("/push", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const list = await findCurrentList(userId);
  if (!list) {
    res.status(404).json({ error: "No grocery list" });
    return;
  }
  const items = readItems(list.items).map((i) => ({ ...i, pushed: true }));
  const updated = await prisma.groceryList.update({
    where: { id: list.id },
    data: {
      items: toJson(items),
      pushedToRemindersAt: new Date(),
    },
  });
  res.json({ list: updated });
});

router.get("/pending", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const list = await findCurrentList(userId);
  if (!list) {
    res.json({ items: [] });
    return;
  }
  const items = readItems(list.items).filter((i) => !i.pushed && !i.checked);
  res.json({ items });
});

router.post("/confirm-push", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const list = await findCurrentList(userId);
  if (!list) {
    res.status(404).json({ error: "No grocery list" });
    return;
  }
  const items = readItems(list.items).map((i) =>
    i.pushed ? i : { ...i, pushed: true },
  );
  const updated = await prisma.groceryList.update({
    where: { id: list.id },
    data: { items: toJson(items), pushedToRemindersAt: new Date() },
  });
  res.json({ list: updated });
});

export default router;
