import { useMemo } from "react";
import { deriveOnboardingState } from "~/features/organizations/domain/membership";
import { useOrganizationDirectory } from "~/features/organizations/hooks/use-organization-directory";

export function useOrganizationOnboardingState() {
  const { organizations, isLoading } = useOrganizationDirectory();

  const state = useMemo(
    () => (organizations ? deriveOnboardingState(organizations) : undefined),
    [organizations],
  );

  return { state, isLoading };
}
