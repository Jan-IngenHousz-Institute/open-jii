import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

export const useCalibrationDefinitions = (
  family: CalibrationFamily | undefined,
  options?: { enabled?: boolean },
) =>
  useQuery(
    orpc.iot.listCalibrationDefinitions.queryOptions({
      // A placeholder keeps the input typed; the query is held until the family is known.
      input: { family: family ?? "minipar" },
      enabled: (options?.enabled ?? true) && family !== undefined,
    }),
  );
