import { Router } from "express";
import { z } from "zod";
import { prisma } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import { computeTargets } from "../services/targets.js";

const router = Router();

export const EQUIPMENT_OPTIONS = [
  "barbell",
  "dumbbells",
  "kettlebells",
  "pull_up_bar",
  "bench",
  "squat_rack",
  "cable_machine",
  "resistance_bands",
  "cardio_machine",
] as const;

const profileSchema = z.object({
  unitSystem: z.enum(["imperial", "metric"]).default("imperial"),
  age: z.number().int().min(10).max(100).nullable().optional(),
  sex: z.enum(["male", "female"]).nullable().optional(),
  weightLbs: z.number().positive().nullable().optional(),
  heightIn: z.number().positive().nullable().optional(),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  trainingDaysPerWeek: z.number().int().min(1).max(7),
  goal: z.enum(["build_muscle", "lose_fat", "maintain"]),
  caloricTarget: z.number().int().positive().nullable().optional(),
  proteinTargetG: z.number().int().positive().nullable().optional(),
  dietaryNotes: z.string().max(500).nullable().optional(),
  mealComplexity: z.enum(["varied", "simple", "prep"]).default("varied"),
  equipment: z.array(z.enum(EQUIPMENT_OPTIONS)).default([]),
  hydrationGoal: z.number().int().min(1).max(20).optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const suggested = profile
    ? computeTargets({
        sex: profile.sex,
        age: profile.age,
        weightLbs: profile.weightLbs,
        heightIn: profile.heightIn,
        trainingDaysPerWeek: profile.trainingDaysPerWeek,
        goal: profile.goal,
      })
    : null;
  res.json({ profile, suggested });
});

router.put("/", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });

  const suggested = computeTargets({
    sex: parsed.data.sex ?? null,
    age: parsed.data.age ?? null,
    weightLbs: parsed.data.weightLbs ?? null,
    heightIn: parsed.data.heightIn ?? null,
    trainingDaysPerWeek: parsed.data.trainingDaysPerWeek,
    goal: parsed.data.goal,
  });

  const data = {
    ...parsed.data,
    caloricTarget:
      parsed.data.caloricTarget === undefined
        ? suggested?.caloricTarget ?? null
        : parsed.data.caloricTarget,
    proteinTargetG:
      parsed.data.proteinTargetG === undefined
        ? suggested?.proteinTargetG ?? null
        : parsed.data.proteinTargetG,
  };

  const profile = await prisma.profile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  res.json({ profile, suggested });
});

export default router;
