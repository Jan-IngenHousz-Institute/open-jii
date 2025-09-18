import { tsr } from "../../../lib/tsr";

export function useMacro(id: string) {
  const query = tsr.macros.getMacro.useQuery({
    queryData: { params: { id } },
    queryKey: ["macro", id],
  });

  return {
    data: query.data?.body,
    isLoading: query.isLoading,
    error: query.error,
  };
}
