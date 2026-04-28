import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/api";

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  loadLbs: number | null;
  restSeconds: number;
  notes?: string;
}

export interface TrainingDay {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  focus: string;
  exercises: Exercise[];
}

export interface WeeklyPlanJson {
  summary: string;
  progressionNotes: string;
  days: TrainingDay[];
}

export interface WeeklyPlanRecord {
  id: string;
  userId: string;
  weekStartDate: string;
  planJson: WeeklyPlanJson;
  isActive: boolean;
  createdAt: string;
}

export function useCurrentWorkoutPlan(weekStart?: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["workouts", "current", weekStart ?? "active"],
    queryFn: async () => {
      const params = weekStart ? `?weekStart=${weekStart}` : "";
      const { data } = await api.get<{ plan: WeeklyPlanRecord | null }>(`/api/workouts/current${params}`);
      return data.plan;
    },
  });
}

export function useGenerateWorkoutPlan() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts?: { targetWeekStart?: string }) => {
      const { data } = await api.post<{ plan: WeeklyPlanRecord }>("/api/workouts/generate", {
        targetWeekStart: opts?.targetWeekStart,
      });
      return data.plan;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workouts"] });
    },
  });
}

export function useUpdateExerciseLoad() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      day: TrainingDay["day"];
      index: number;
      loadLbs: number;
    }) => {
      const { data } = await api.patch<{ plan: WeeklyPlanRecord }>(
        "/api/workouts/exercise",
        args,
      );
      return data.plan;
    },
    onSuccess: () => {
      // The plan changed and we just logged a new PR — refresh both.
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}
