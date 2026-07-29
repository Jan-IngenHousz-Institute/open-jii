import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * The experiment's credited contributors: everyone who holds a grant on it, and
 * can therefore add measurements and annotations.
 *
 * Read-gated, unlike the sharing collaborators list — this is the public-facing
 * credit (names and avatars), not an enumeration of who holds which tier.
 */
export const useExperimentContributors = (experimentId: string) => {
  return useQuery(
    orpc.experiments.listExperimentContributors.queryOptions({
      input: { id: experimentId },
    }),
  );
};
