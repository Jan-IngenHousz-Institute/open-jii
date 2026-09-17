import { useMemo } from "react";
import { deriveOnboardingState } from "~/features/organizations/domain/membership";
import { useOrganizationDirectory } from "~/features/organizations/hooks/use-organization-directory";

export function useOrganizationOnboardingState() {
  const related = useOrganizationDirectory({ scope: "related" });

  const hasRelated = related.organizations !== undefined;
  const isMember = related.organizations?.some((o) => o.membershipStatus === "member") ?? false;

  // `related` filters on membership, so it can never carry a pending request.
  // Only the unfiltered directory can, which is why the wide fetch exists at
  // all; it waits until the cheap query has ruled membership out.
  const directoryEnabled = hasRelated && !isMember;
  const directory = useOrganizationDirectory({ scope: "all", enabled: directoryEnabled });

  const state = useMemo(() => {
    if (isMember) return { kind: "member" } as const;
    if (!hasRelated || !directory.organizations) return undefined;
    return deriveOnboardingState(directory.organizations);
  }, [isMember, hasRelated, directory.organizations]);

  return {
    state,
    isLoading: related.isLoading || (directoryEnabled && directory.isLoading),
    error: related.error ?? directory.error,
    isPaused: related.isPaused || directory.isPaused,
  };
}
