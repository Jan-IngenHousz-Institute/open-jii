import { tsr } from "../../../lib/tsr";

export function useProtocolVersions(id: string, enabled = true) {
  const query = tsr.protocols.listProtocolVersions.useQuery({
    queryData: { params: { id } },
    queryKey: ["protocol-versions", id],
    enabled,
  });

  return {
    data: query.data?.body,
    isLoading: query.isLoading,
    error: query.error,
  };
}
