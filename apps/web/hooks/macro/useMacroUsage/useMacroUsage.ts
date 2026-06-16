import { shouldRetryQuery } from "@/util/query-retry";

import { tsr } from "../../../lib/tsr";

/** How many workbooks reference this macro, for the "used by N workbooks" warning. */
export const useMacroUsage = (macroId: string, options?: { enabled?: boolean }) => {
  return tsr.macros.getMacroUsage.useQuery({
    queryData: { params: { id: macroId } },
    queryKey: ["macroUsage", macroId],
    enabled: options?.enabled ?? !!macroId,
    retry: shouldRetryQuery,
  });
};
