import { Router } from "express";
import { prisma } from "@platform/db";
import { z } from "zod";
import { currentUserId, requireAuth } from "../middleware/auth.js";

const router = Router();

const settingsSchema = z.object({
  unitSystem: z.enum(["imperial", "metric"]).optional(),
  hydrationGoal: z.number().int().min(1).max(20).optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });

  const [settings, profile] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.profile.findUnique({ where: { userId } }),
  ]);

  res.json({
    settings: {
      unitSystem: settings?.unitSystem ?? profile?.unitSystem ?? "imperial",
      hydrationGoal: settings?.hydrationGoal ?? 8,
    },
  });
});

router.patch("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });

  const updateData: Record<string, unknown> = {};
  if (parsed.data.unitSystem != null) updateData.unitSystem = parsed.data.unitSystem;
  if (parsed.data.hydrationGoal != null) updateData.hydrationGoal = parsed.data.hydrationGoal;

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: updateData,
    create: {
      userId,
      unitSystem: parsed.data.unitSystem ?? "imperial",
      ...(parsed.data.hydrationGoal != null && { hydrationGoal: parsed.data.hydrationGoal }),
    },
  });

  if (parsed.data.unitSystem != null) {
    await prisma.profile.updateMany({
      where: { userId },
      data: { unitSystem: parsed.data.unitSystem },
    });
  }

  res.json({
    settings: {
      unitSystem: settings.unitSystem,
      hydrationGoal: settings.hydrationGoal,
    },
  });
});

export default router;
