import { tsr } from "../../../lib/tsr";

export function useMacro(id: string) {
  const query = tsr.macros.getMacro.useQuery({
    queryData: { params: { id } },
    queryKey: ["macro", id],
    retry: (failureCount, error) => {
      // Don't retry on 4xx client errors - these are not transient
      const err = error as unknown;
      if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        typeof err.status === "number" &&
        err.status >= 400 &&
        err.status < 500
      ) {
        return false;
      }
      // Use default retry logic for other errors (up to 3 times)
      return failureCount < 3;
    },
  });

  return {
    data: query.data?.body,
    isLoading: query.isLoading,
    error: query.error,
  };
}
