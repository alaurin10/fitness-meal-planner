import { useCallback } from "react";
import { ErrorState } from "../../components/ErrorState";
import { SkeletonList } from "../../components/Skeleton";
import { useToast } from "../../components/Toast";
import {
  useProfile,
  useSaveProfile,
  type ProfileInput,
} from "../../hooks/useProfile";
import { useSettings } from "../../hooks/useSettings";
import type { UnitSystem } from "../../lib/units";
import { isProfileComplete, profileToForm, shouldUseSuggested } from "./helpers";
import { NumbersSection } from "./sections/NumbersSection";
import { NutritionSection } from "./sections/NutritionSection";
import { TargetsSection } from "./sections/TargetsSection";
import { TrainingSection } from "./sections/TrainingSection";
import { SetupForm } from "./SetupForm";
import type { SaveSection } from "./types";

export function ProfileTab() {
  const query = useProfile();
  const settingsQuery = useSettings();
  const save = useSaveProfile();
  const toast = useToast();

  const profile = query.data?.profile ?? null;
  const suggested = query.data?.suggested ?? null;
  const settingsUnitSystem = settingsQuery.data?.unitSystem;

  /**
   * Merges a section's draft into the full saved profile and PUTs it.
   * The server stores suggested targets when caloricTarget/proteinTargetG are
   * omitted and custom values when they're sent — so unless the Targets sheet
   * explicitly passes flags, we re-derive the current mode from the saved
   * profile and omit accordingly. That way editing e.g. weight while targets
   * are in suggested mode keeps them suggested (recomputed server-side).
   */
  const saveSection: SaveSection = useCallback(
    async (draft, flags) => {
      const current = query.data?.profile;
      if (!current) return;
      const currentSuggested = query.data?.suggested ?? null;
      const base = profileToForm(current);
      const merged: ProfileInput = {
        ...base,
        ...draft,
        unitSystem: settingsUnitSystem ?? base.unitSystem,
      };
      const caloriesSuggested =
        flags?.useSuggestedCalories ??
        shouldUseSuggested(current.caloricTarget, currentSuggested?.caloricTarget);
      const proteinSuggested =
        flags?.useSuggestedProtein ??
        shouldUseSuggested(current.proteinTargetG, currentSuggested?.proteinTargetG);

      await save.mutateAsync({
        ...merged,
        caloricTarget: caloriesSuggested ? undefined : merged.caloricTarget,
        proteinTargetG: proteinSuggested ? undefined : merged.proteinTargetG,
      });
      toast.success("Saved");
    },
    [query.data, save, settingsUnitSystem, toast],
  );

  if (query.isLoading) {
    return (
      <div className="px-4 pt-4">
        <SkeletonList count={3} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="px-4 pt-4">
        <ErrorState error={query.error} onRetry={() => query.refetch()} retrying={query.isRefetching} />
      </div>
    );
  }

  // First-time setup (or a profile missing core stats): one-shot full form.
  if (!profile || !isProfileComplete(profile)) {
    return <SetupForm profile={profile} />;
  }

  const unitSystem: UnitSystem = settingsUnitSystem ?? profile.unitSystem ?? "imperial";

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="md:grid md:grid-cols-2 md:gap-4 space-y-5 md:space-y-0">
        <NumbersSection
          profile={profile}
          unitSystem={unitSystem}
          onSave={saveSection}
          saving={save.isPending}
        />
        <TrainingSection profile={profile} onSave={saveSection} saving={save.isPending} />
      </div>
      <div className="pt-5">
        <TargetsSection
          profile={profile}
          suggested={suggested}
          onSave={saveSection}
          saving={save.isPending}
        />
      </div>
      <div className="pt-5">
        <NutritionSection profile={profile} onSave={saveSection} saving={save.isPending} />
      </div>
    </div>
  );
}
