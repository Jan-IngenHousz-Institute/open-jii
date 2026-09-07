import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { CalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

/** Definitions the caller may read, narrowed to one device family. */
export const useCalibrationDefinitions = (
  family: CalibrationFamily | undefined,
  options?: { enabled?: boolean },
) =>
  useQuery(
    orpc.iot.listCalibrationDefinitions.queryOptions({
      // Only a placeholder to keep the input typed: the query is held until
      // the device reports a family calibrations exist for.
      input: { family: family ?? "minipar" },
      enabled: (options?.enabled ?? true) && family !== undefined,
    }),
  );
