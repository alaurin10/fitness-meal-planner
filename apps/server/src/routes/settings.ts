import { Router } from "express";
import { prisma } from "@platform/db";
import { z } from "zod";
import { ALL_DAYS } from "@platform/shared";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import { parseSlotMask, slotMaskSchema } from "../services/mealScheduleMask.js";

const router = Router();

const settingsSchema = z.object({
  unitSystem: z.enum(["imperial", "metric"]).optional(),
  weekStartDay: z.enum(ALL_DAYS as unknown as [string, ...string[]]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  /** Recurring skip template: slots NOT to plan, per day. */
  mealSchedule: slotMaskSchema.optional(),
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
      weekStartDay: settings?.weekStartDay ?? "Mon",
      theme: settings?.theme ?? "system",
      mealSchedule: parseSlotMask(settings?.mealScheduleJson),
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

  const patch = {
    ...(parsed.data.unitSystem ? { unitSystem: parsed.data.unitSystem } : {}),
    ...(parsed.data.weekStartDay ? { weekStartDay: parsed.data.weekStartDay } : {}),
    ...(parsed.data.theme ? { theme: parsed.data.theme } : {}),
    ...(parsed.data.mealSchedule !== undefined
      ? { mealScheduleJson: parsed.data.mealSchedule as object }
      : {}),
  };

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: patch,
    create: { userId, ...patch },
  });

  if (parsed.data.unitSystem) {
    await prisma.profile.updateMany({
      where: { userId },
      data: { unitSystem: parsed.data.unitSystem },
    });
  }

  res.json({
    settings: {
      unitSystem: settings.unitSystem,
      weekStartDay: settings.weekStartDay,
      theme: settings.theme,
      mealSchedule: parseSlotMask(settings.mealScheduleJson),
    },
  });
});

export default router;
