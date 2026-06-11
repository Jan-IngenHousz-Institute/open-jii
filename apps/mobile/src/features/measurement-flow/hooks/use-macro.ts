import { contentKeys } from "~/shared/api/content-query-keys";
import { tsr } from "~/shared/api/tsr";

export function useMacro(macroId: string | undefined) {
  const { data, isLoading, error } = tsr.macros.getMacro.useQuery({
    queryKey: contentKeys.macro(macroId),
    queryData: { params: { id: macroId ?? "" } },
    enabled: !!macroId,
    networkMode: "offlineFirst",
  });

  const macro = data?.body;

  return {
    macro,
    isLoading,
    error,
  };
}
