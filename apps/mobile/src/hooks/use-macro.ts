import { tsr } from "~/api/tsr";

export function useMacro(macroId: string | undefined) {
  const { data, isLoading, error } = tsr.macros.getMacro.useQuery({
    queryKey: ["macro", macroId],
    queryData: { params: { id: macroId ?? "" } },
    enabled: !!macroId,
  });

  const macro = data?.body;

  return {
    macro,
    isLoading,
    error,
  };
}
