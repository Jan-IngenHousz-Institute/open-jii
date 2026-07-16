import { orpcClient } from "./orpc";

/**
 * Plain oRPC client for use outside of React components.
 * For React Query hooks, use `orpc` from ~/shared/api/orpc instead.
 */
export function getApiClient() {
  return orpcClient;
}
