import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** Ten seconds: fast enough to follow a room filling up, cheap enough for one row. */
const JOIN_CODE_POLL_INTERVAL_MS = 10_000;

/**
 * The active join code for an experiment, or `null` when there is none.
 *
 * Redemptions happen on phones, so nothing in this browser can invalidate the
 * query; without the poll the redemption counter would stay at its first value
 * for the whole workshop.
 */
export const useExperimentJoinCode = (experimentId: string, options?: { enabled?: boolean }) => {
  return useQuery(
    orpc.experiments.getJoinCode.queryOptions({
      input: { id: experimentId },
      enabled: !!experimentId && (options?.enabled ?? true),
      refetchInterval: JOIN_CODE_POLL_INTERVAL_MS,
      refetchIntervalInBackground: false,
    }),
  );
};
