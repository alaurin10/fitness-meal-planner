import type { WeekStartDay } from "@platform/shared";
import { useSettings } from "./useSettings";

export function useWeekStartDay(): WeekStartDay {
  const { data } = useSettings();
  return (data?.weekStartDay ?? "Mon") as WeekStartDay;
}
