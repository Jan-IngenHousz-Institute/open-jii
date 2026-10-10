import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { calibrationDefinitionsQuery } from "./calibration-definitions-query";

/** Every definition the caller can read; the sibling hook is family-scoped. */
export const useAllCalibrationDefinitions = () => useQuery(calibrationDefinitionsQuery(orpc));
