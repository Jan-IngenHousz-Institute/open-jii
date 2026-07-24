import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { env } from "~/env";

import { contract } from "@repo/api/contract";

import { orpcClientHeaders } from "./orpc-headers";

const link = new OpenAPILink(contract, {
  url: env.NEXT_PUBLIC_API_URL,
  headers: () => orpcClientHeaders(),
  // Send the session cookie with every request (browser-managed); oRPC throws
  // an ORPCError on >= 400, which hooks narrow via `getOrpcError`.
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
});

/** Plain oRPC client for use outside of React components. */
export const orpcClient: ContractRouterClient<typeof contract> = createORPCClient(link);

/** TanStack Query utilities (`orpc.<domain>.<endpoint>.queryOptions/mutationOptions(...)`). */
export const orpc = createTanstackQueryUtils(orpcClient);

/**
 * Narrows a thrown error to an `ORPCError` (carrying `.status` / `.code`) for
 * status-based handling in mutation `onError`. Returns undefined for non-oRPC
 * errors (network failures, etc.), which callers treat as a generic failure.
 */
export function getOrpcError(error: unknown): ORPCError<string, unknown> | undefined {
  return error instanceof ORPCError ? error : undefined;
}
