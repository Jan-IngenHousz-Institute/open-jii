import { tsr } from "~/api/tsr";

export function useMacro(macroId: string | undefined, version?: number) {
  const { data, isLoading, error } = tsr.macros.getMacro.useQuery({
    queryKey: ["macro", macroId, version],
    queryData: { params: { id: macroId ?? "" }, query: { version } },
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
