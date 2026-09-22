import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { ProtocolList } from "@repo/api/domains/protocol/protocol.schema";
import { listItems } from "@repo/api/shared/listing";

/**
 * Hook to fetch a list of protocols with optional search functionality
 * @param search Search term (controlled externally)
 * @returns Query result containing the protocols list
 */

interface useProtocolSearchResult {
  protocols: ProtocolList | undefined;
  isLoading: boolean;
  error: unknown;
}

export const useProtocolSearch = (search = ""): useProtocolSearchResult => {
  const { data, isLoading, error } = useQuery(
    orpc.protocols.listProtocols.queryOptions({
      input: { search: search || undefined },
    }),
  );

  // Narrowed to the array shape: no `page` is sent here, so the response is always
  // the bare list. Deletable once this caller migrates to the envelope.
  const protocols = data ? listItems(data) : undefined;

  return {
    protocols,
    isLoading: isLoading,
    error,
  };
};
