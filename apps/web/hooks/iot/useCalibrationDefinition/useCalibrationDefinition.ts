import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** One definition in full: the procedure the wizard interprets and the schema it reviews against. */
export const useCalibrationDefinition = (
  definitionId: string | null,
  options?: { enabled?: boolean },
) =>
  useQuery(
    orpc.iot.getCalibrationDefinition.queryOptions({
      input: { definitionId: definitionId ?? "" },
      enabled: (options?.enabled ?? true) && definitionId !== null,
    }),
  );
