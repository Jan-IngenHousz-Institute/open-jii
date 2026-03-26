import { tsr } from "~/api/tsr";

export function useProtocol(protocolId: string | undefined, version?: number) {
  const { data, isLoading, error } = tsr.protocols.getProtocol.useQuery({
    queryKey: ["protocol", protocolId, version],
    queryData: { params: { id: protocolId ?? "" }, query: { version } },
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
