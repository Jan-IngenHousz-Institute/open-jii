import { initClient } from "@ts-rest/core";

import { contract } from "@repo/api/contract";

import { baseClientOptions } from "./fetcher";

/**
 * Plain ts-rest client for use outside of React components.
 * For React Query hooks, use `tsr` from ~/api/tsr instead.
 */
export function getApiClient() {
  return initClient(contract, baseClientOptions);
}
