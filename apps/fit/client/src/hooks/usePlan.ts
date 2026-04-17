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

export function useCurrentPlan() {
  const api = useApi();
  return useQuery({
    queryKey: ["fit", "plan", "current"],
    queryFn: async () => {
      const { data } = await api.get<{ plan: WeeklyPlanRecord | null }>("/api/plans/current");
      return data.plan;
    },
  });
}

export function useGeneratePlan() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ plan: WeeklyPlanRecord }>("/api/plans/generate");
      return data.plan;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fit", "plan"] });
    },
  });
}
