import type { QueryUtils } from "@/lib/orpc";

import type { ProtocolSort } from "@repo/api/domains/protocol/protocol.schema";

interface ProtocolsListView {
  search?: string;
  page: number;
  sort?: ProtocolSort;
}

/** One view of the protocols list, built the same way for the hook and for the server. */
export function protocolsListQuery(utils: QueryUtils, view: ProtocolsListView) {
  return utils.protocols.listProtocols.queryOptions({
    input: {
      search: view.search && view.search.trim() !== "" ? view.search : undefined,
      page: view.page,
      sort: view.sort?.length ? view.sort : undefined,
    },
  });
}
