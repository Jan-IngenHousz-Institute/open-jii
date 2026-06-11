import { contentKeys } from "~/shared/api/content-query-keys";
import { tsr } from "~/shared/api/tsr";

export function useProtocol(protocolId: string | undefined) {
  const { data, isLoading, error } = tsr.protocols.getProtocol.useQuery({
    queryKey: contentKeys.protocol(protocolId),
    queryData: { params: { id: protocolId ?? "" } },
    enabled: !!protocolId,
    networkMode: "offlineFirst",
  });

  const protocol = data?.body;

  return {
    protocol,
    isLoading,
    error,
  };
}
