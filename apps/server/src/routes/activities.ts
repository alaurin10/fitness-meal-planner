import { Router } from "express";
import { z } from "zod";
import { prisma } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";

const router = Router();

const activitySchema = z.object({
  activityName: z.string().min(1).max(100),
  performedAt: z.coerce.date(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  activeCalories: z.number().int().positive().nullable().optional(),
  distanceMiles: z.number().positive().nullable().optional(),
  note: z.string().max(500).optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const logs = await prisma.activityLog.findMany({
    where: { userId },
    orderBy: { performedAt: "desc" },
    take: 60,
  });
  res.json({ logs });
});

router.post("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });

  const log = await prisma.activityLog.create({
    data: {
      userId,
      activityName: parsed.data.activityName,
      performedAt: parsed.data.performedAt,
      durationMinutes: parsed.data.durationMinutes ?? null,
      activeCalories: parsed.data.activeCalories ?? null,
      distanceMiles: parsed.data.distanceMiles ?? null,
      note: parsed.data.note ?? null,
    },
  });

  res.json({ log });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const id = String(req.params.id);

  const existing = await prisma.activityLog.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  await prisma.activityLog.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
