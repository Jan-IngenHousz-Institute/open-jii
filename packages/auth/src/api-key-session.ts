interface ApiKeySessionContext {
  path?: string;
  headers?: Headers;
}

/**
 * API keys may create a mocked Better Auth session only for the get-session
 * call made by the Nest AuthGuard. Returning a key for any other auth route
 * would let that key authorize credential or account management endpoints.
 */
export function getApiKeyForSessionCheck(ctx: ApiKeySessionContext): string | null {
  if (ctx.path !== "/get-session") return null;
  return ctx.headers?.get("x-api-key") ?? null;
}
