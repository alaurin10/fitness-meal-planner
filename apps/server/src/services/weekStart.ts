export type WeekKey = "current" | "next";

export function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + mondayOffset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function weekStartFor(week: WeekKey, now: Date = new Date()): Date {
  const start = startOfWeek(now);
  if (week === "next") start.setDate(start.getDate() + 7);
  return start;
}

export function parseWeekParam(value: unknown): WeekKey {
  return value === "next" ? "next" : "current";
}
