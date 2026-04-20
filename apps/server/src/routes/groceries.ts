import { Router } from "express";
import { z } from "zod";
import { prisma, Prisma, type GroceryItem } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";

const router = Router();

const toggleSchema = z.object({ checked: z.boolean() });

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

router.get("/current", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const list = await findCurrentList(userId);
  res.json({ list });
});

router.patch("/items/:itemId", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = toggleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const list = await findCurrentList(userId);
  if (!list) {
    res.status(404).json({ error: "No grocery list" });
    return;
  }
  const items = readItems(list.items);
  const next = items.map((item) =>
    item.id === req.params.itemId ? { ...item, checked: parsed.data.checked } : item,
  );
  const updated = await prisma.groceryList.update({
    where: { id: list.id },
    data: { items: toJson(next) },
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
