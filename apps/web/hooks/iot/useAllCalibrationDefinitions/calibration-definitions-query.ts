import type { QueryUtils } from "@/lib/orpc";

/** Every calibration definition the user sees, built the same way for the hook and the server. */
export function calibrationDefinitionsQuery(utils: QueryUtils) {
  return utils.iot.listCalibrationDefinitions.queryOptions({ input: {} });
}
