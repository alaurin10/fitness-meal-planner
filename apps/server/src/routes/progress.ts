import { Router } from "express";
import { z } from "zod";
import { prisma } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import { computeTargets } from "../services/targets.js";

const router = Router();

const progressSchema = z.object({
  weightLbs: z.number().positive().nullable().optional(),
  note: z.string().max(500).optional(),
  liftPRs: z.record(z.number().positive()).optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const logs = await prisma.progressLog.findMany({
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
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });

  const log = await prisma.progressLog.create({
    data: {
      userId,
      weightLbs: parsed.data.weightLbs ?? null,
      note: parsed.data.note ?? null,
      liftPRs: parsed.data.liftPRs ?? undefined,
    },
  });

  // Sync weight back to the profile so calorie/protein targets stay accurate.
  // If the user's stored targets currently match the suggested values for their
  // OLD weight, they're on "suggested" mode — recompute targets at the new
  // weight. Otherwise they've explicitly overridden the targets, so preserve.
  let profile = null;
  if (parsed.data.weightLbs != null) {
    const current = await prisma.profile.findUnique({ where: { userId } });
    if (current) {
      const oldSuggested = computeTargets({
        sex: current.sex,
        age: current.age,
        weightLbs: current.weightLbs,
        heightIn: current.heightIn,
        trainingDaysPerWeek: current.trainingDaysPerWeek,
        goal: current.goal,
      });
      const newSuggested = computeTargets({
        sex: current.sex,
        age: current.age,
        weightLbs: parsed.data.weightLbs,
        heightIn: current.heightIn,
        trainingDaysPerWeek: current.trainingDaysPerWeek,
        goal: current.goal,
      });

      const onSuggestedCalories =
        oldSuggested != null && current.caloricTarget === oldSuggested.caloricTarget;
      const onSuggestedProtein =
        oldSuggested != null && current.proteinTargetG === oldSuggested.proteinTargetG;

      profile = await prisma.profile.update({
        where: { userId },
        data: {
          weightLbs: parsed.data.weightLbs,
          caloricTarget:
            onSuggestedCalories && newSuggested
              ? newSuggested.caloricTarget
              : current.caloricTarget,
          proteinTargetG:
            onSuggestedProtein && newSuggested
              ? newSuggested.proteinTargetG
              : current.proteinTargetG,
        },
      });
    }
  }

  res.json({ log, profile });
});

export default router;
