import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** Every definition the caller can read; the sibling hook is family-scoped. */
export const useAllCalibrationDefinitions = () =>
  useQuery(orpc.iot.listCalibrationDefinitions.queryOptions({ input: {} }));
