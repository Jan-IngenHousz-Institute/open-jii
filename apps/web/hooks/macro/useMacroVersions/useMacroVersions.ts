import { tsr } from "../../../lib/tsr";

export function useMacroVersions(id: string, enabled = true) {
  const query = tsr.macros.listMacroVersions.useQuery({
    queryData: { params: { id } },
    queryKey: ["macro-versions", id],
    enabled,
  });

  return {
    data: query.data?.body,
    isLoading: query.isLoading,
    error: query.error,
  };
}
