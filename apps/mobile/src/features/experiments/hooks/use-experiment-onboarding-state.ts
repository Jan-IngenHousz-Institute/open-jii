import { useMemo } from "react";
import { deriveExperimentOnboardingState } from "~/features/experiments/domain/membership";
import { useExperiments } from "~/features/experiments/hooks/use-experiments";

/**
 * Reads the `related` list the measurement picker already caches. Home never
 * fetches the wide directory: that list is paginated, and a pending request is
 * one tap away in the directory anyway.
 */
export function useExperimentOnboardingState() {
  const { rows, isLoading, isPaused, error } = useExperiments();

  const state = useMemo(() => deriveExperimentOnboardingState(rows), [rows]);

  return { state, isLoading, isPaused, error };
}
