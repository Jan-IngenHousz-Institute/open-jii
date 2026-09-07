import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useCalibrationRun = (runId: string | null, options?: { enabled?: boolean }) =>
  useQuery(
    orpc.iot.getCalibrationRun.queryOptions({
      input: { runId: runId ?? "" },
      enabled: (options?.enabled ?? true) && runId !== null,
    }),
  );
