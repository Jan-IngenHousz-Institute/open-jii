import { shouldRetryQuery } from "@/util/query-retry";

import { tsr } from "../../../lib/tsr";

/** Version history for a macro (newest first), for the history/restore UI. */
export const useMacroVersions = (macroId: string, options?: { enabled?: boolean }) => {
  return tsr.macros.listMacroVersions.useQuery({
    queryData: { params: { id: macroId } },
    queryKey: ["macroVersions", macroId],
    enabled: options?.enabled ?? !!macroId,
    retry: shouldRetryQuery,
  });
};
