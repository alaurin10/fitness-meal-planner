import { Router } from "express";
import { z } from "zod";
import { fitPrisma } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";

const router = Router();

const profileSchema = z.object({
  age: z.number().int().min(10).max(100).nullable().optional(),
  weightLbs: z.number().positive().nullable().optional(),
  heightIn: z.number().positive().nullable().optional(),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  trainingDaysPerWeek: z.number().int().min(1).max(7),
  goal: z.enum(["build_muscle", "lose_fat", "maintain"]),
});

router.get("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  await fitPrisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });
  const profile = await fitPrisma.fitProfile.findUnique({ where: { userId } });
  res.json({ profile });
});

router.put("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await fitPrisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });
  const profile = await fitPrisma.fitProfile.upsert({
    where: { userId },
    create: { userId, ...parsed.data },
    update: parsed.data,
  });
  res.json({ profile });
});

export default router;
