import type { MacroFilterQuery } from "@repo/api";

import { tsr } from "../../../lib/tsr";

export function useMacros(filter?: MacroFilterQuery) {
  const query = tsr.macros.listMacros.useQuery({
    queryData: {
      query: filter ?? {},
    },
    queryKey: ["macros", filter],
  });

  return {
    data: query.data?.body,
    isLoading: query.isLoading,
    error: query.error,
  };
}
