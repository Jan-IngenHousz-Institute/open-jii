import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Every calibration definition the caller can read, across families.
 *
 * The sibling hook is family-scoped because a device page knows which family it is asking
 * about, and asks nothing until it does. The library has no device, so it asks for all.
 */
export const useAllCalibrationDefinitions = () =>
  useQuery(orpc.iot.listCalibrationDefinitions.queryOptions({ input: {} }));
