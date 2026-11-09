import { orpc } from "@/lib/orpc";

import { zProtocolFamily, zProtocolSort } from "@repo/api/domains/protocol/protocol.schema";
import { zVisibility } from "@repo/api/domains/visibility/visibility.schema";

import { useResourceList } from "../../useResourceList";
import { protocolsListQuery } from "./protocols-list-query";

const PROTOCOL_LIST_FILTERS = { family: zProtocolFamily, visibility: zVisibility };

/** The protocols list: family and visibility filters, search and sort in the URL, server-paged. */
export function useProtocols() {
  return useResourceList({
    searchKey: "q",
    filters: PROTOCOL_LIST_FILTERS,
    sort: zProtocolSort,
    query: (view) =>
      protocolsListQuery(orpc, {
        search: view.search,
        page: view.page,
        sort: view.sort,
        families: view.filters.family,
        visibilities: view.filters.visibility,
      }),
  });
}
