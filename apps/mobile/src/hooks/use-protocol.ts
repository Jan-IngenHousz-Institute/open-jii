import { tsr } from "~/api/tsr";

export function useProtocol(protocolId: string | undefined) {
  const { data, isLoading, error } = tsr.protocols.getProtocol.useQuery({
    queryKey: ["protocol", protocolId],
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
