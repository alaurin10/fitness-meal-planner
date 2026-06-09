import { addWeeks, parseLocalDate } from "@platform/shared";

/**
 * Date bounds for fetching weekly plans relevant to a history range.
 * A plan whose weekStartDate is up to 6 days before `from` can still cover
 * the first days of the range, so the lower bound backs up one week.
 * Bounds are built with parseLocalDate to match how weekStartDate rows are
 * stored (local midnight).
 */
export function historyPlanDateBounds(
  from: string,
  to: string,
): { gte: Date; lte: Date } {
  return {
    gte: addWeeks(parseLocalDate(from), -1),
    lte: parseLocalDate(to),
  };
}
