import { z } from "zod";

export const weekdaySchema = z.enum([
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
]);

export const exerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().positive().catch(3),
  reps: z.string().min(1).catch("—"),
  loadLbs: z.number().nullable().catch(null),
  restSeconds: z.number().int().nonnegative().catch(60),
  notes: z.string().optional(),
});

export const trainingDaySchema = z.object({
  day: weekdaySchema,
  focus: z.string().min(1),
  exercises: z.array(exerciseSchema).min(1),
});

export const weeklyPlanSchema = z.object({
  summary: z.string().min(1),
  progressionNotes: z.string().min(1),
  days: z.array(trainingDaySchema).min(1),
});

export type WeeklyPlanJson = z.infer<typeof weeklyPlanSchema>;
