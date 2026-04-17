import { Router } from "express";
import { z } from "zod";
import { mealsPrisma } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";

const router = Router();

const profileSchema = z.object({
  caloricTarget: z.number().int().positive().nullable().optional(),
  proteinTargetG: z.number().int().positive().nullable().optional(),
  dietaryNotes: z.string().max(500).nullable().optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  await mealsPrisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });
  const profile = await mealsPrisma.mealProfile.findUnique({
    where: { userId },
  });
  res.json({ profile });
});

router.put("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await mealsPrisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });
  const profile = await mealsPrisma.mealProfile.upsert({
    where: { userId },
    create: { userId, ...parsed.data },
    update: parsed.data,
  });
  res.json({ profile });
});

export default router;
