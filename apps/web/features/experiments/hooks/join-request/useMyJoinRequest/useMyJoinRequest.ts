import { tsr } from "@/shared/api/tsr";

/**
 * Hook that returns the signed-in user's pending join request for an experiment,
 * or `undefined` if there is none. A 404 from the API is treated as "no request".
 */
export const useMyJoinRequest = (experimentId: string, enabled = true) => {
  return tsr.experiments.getMyJoinRequest.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["experiment-join-request-mine", experimentId],
    enabled: !!experimentId && enabled,
    retry(failureCount: number, error: unknown) {
      interface StatusError {
        status: number;
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        (error as StatusError).status === 404
      ) {
        return false;
      }
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
  });
};
