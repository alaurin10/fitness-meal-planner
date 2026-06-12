import type { ProfileInput } from "../../hooks/useProfile";

/** Overrides for the suggested-vs-custom target mode when a section save
 *  comes from the Targets sheet; other sections leave these undefined so the
 *  saved profile's current mode is preserved. */
export interface TargetFlags {
  useSuggestedCalories?: boolean;
  useSuggestedProtein?: boolean;
}

/** Merges a section's draft into the full profile and PUTs it. Rejects with
 *  the server error so the sheet can stay open and show it inline. */
export type SaveSection = (draft: Partial<ProfileInput>, flags?: TargetFlags) => Promise<void>;
