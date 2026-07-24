import {
  DYNAMIC_COMMAND_REF_CAPABILITY,
  OPENJII_CAPABILITIES_HEADER,
} from "@repo/api/domains/workbook/capabilities";

/**
 * Static headers sent on every oRPC request. Advertising the dynamic-command
 * capability lets the server return dynamic-command workbook versions; without
 * it a dynamic version is refused with HTTP 426. Sent as a header (not a query
 * param) so the React Query cache key is unchanged and offline resume keeps its
 * cached version.
 */
export function orpcClientHeaders(): Record<string, string> {
  return {
    "x-app-source": "orpc",
    [OPENJII_CAPABILITIES_HEADER]: DYNAMIC_COMMAND_REF_CAPABILITY,
  };
}
