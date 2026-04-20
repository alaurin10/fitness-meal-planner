import { Router } from "express";
import { prisma } from "@platform/db";
import { currentUserId, requireAuth } from "../middleware/auth.js";
import { getGeminiErrorMessage } from "../services/gemini.js";
import { generateMealPlan } from "../services/mealPlan.js";
import { getTrainingSchedule } from "../services/schedule.js";
import { buildGroceryItems } from "../services/groceryAggregator.js";

const router = Router();

router.get("/current", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const plan = await prisma.weeklyMealPlan.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ plan });
});

router.post("/generate", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) {
    res.status(400).json({ error: "Create a profile first" });
    return;
  }

  try {
    const schedule = await getTrainingSchedule(userId);
    const planJson = await generateMealPlan({ profile, schedule });

    const weekStart = startOfWeek(new Date());
    const groceryItems = buildGroceryItems(planJson);

    const result = await prisma.$transaction(async (tx) => {
      await tx.weeklyMealPlan.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
      const plan = await tx.weeklyMealPlan.create({
        data: {
          userId,
          weekStartDate: weekStart,
          planJson,
          isActive: true,
        },
      });
      const groceryList = await tx.groceryList.create({
        data: {
          userId,
          weeklyMealPlanId: plan.id,
          items: groceryItems as unknown as object,
        },
      });
      return { plan, groceryList };
    });

    res.json(result);
  } catch (err) {
    const message = getGeminiErrorMessage(err);
    console.error("[meals] generate failed:", message);
    res.status(502).json({ error: "Failed to generate plan", detail: message });
  }
});

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + mondayOffset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default router;
