import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { cookies } from "next/headers";
import { env } from "~/env";

import { contract } from "@repo/api/contract";

/** A client that sends exactly this `Cookie` header, or none when it is empty. */
export function createOrpcClientWithCookie(
  cookieHeader: string,
): ContractRouterClient<typeof contract> {
  const link = new OpenAPILink(contract, {
    url: env.NEXT_PUBLIC_API_URL,
    headers: () => (cookieHeader ? { cookie: cookieHeader } : {}),
  });
  return createORPCClient(link);
}

/**
 * Server-only oRPC client that forwards the incoming request's `Cookie` header
 * so Server Component metadata fetches run under the caller's own session.
 *
 * The browser client in `lib/orpc.ts` relies on `credentials: "include"`, which
 * is a no-op in Node: there is no cookie jar, so a Server Component call would
 * be unauthenticated. Here the cookie is copied explicitly and only for the
 * duration of the request. Importing `next/headers` also keeps this module out
 * of client bundles, so the authenticated path can never leak to the browser.
 */
export async function createServerOrpcClient(): Promise<ContractRouterClient<typeof contract>> {
  return createOrpcClientWithCookie((await cookies()).toString());
}

/**
 * A client that carries no session at all. For data that goes into a page every
 * visitor shares: it never reads the request, so the page can be cached.
 */
export function createAnonymousServerOrpcClient(): ContractRouterClient<typeof contract> {
  return createOrpcClientWithCookie("");
}
