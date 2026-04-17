import { Router } from "express";
import { z } from "zod";
import { fitPrisma } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";

const router = Router();

const progressSchema = z.object({
  weightLbs: z.number().positive().nullable().optional(),
  note: z.string().max(500).optional(),
  liftPRs: z.record(z.number().positive()).optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const logs = await fitPrisma.progressLog.findMany({
    where: { userId },
    orderBy: { loggedAt: "desc" },
    take: 60,
  });
  res.json({ logs });
});

router.post("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await fitPrisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });
  const log = await fitPrisma.progressLog.create({
    data: {
      userId,
      weightLbs: parsed.data.weightLbs ?? null,
      note: parsed.data.note ?? null,
      liftPRs: parsed.data.liftPRs ?? undefined,
    },
  });
  res.json({ log });
});

export default router;
