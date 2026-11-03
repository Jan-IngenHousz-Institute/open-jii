// Matches better-auth.<env>.session_token and its __Secure- variant. Other
// Better Auth cookies, such as a leftover oauth_state, are not a session.
const SESSION_TOKEN_COOKIE = /^[^=]+\.session_token=(.+)$/;

// Every environment shares one cookie jar, so it can hold one token per environment.
export function getSessionTokens(cookie: string | null | undefined): string[] {
  return (cookie ?? "").split(/;\s*/).flatMap((pair) => SESSION_TOKEN_COOKIE.exec(pair)?.[1] ?? []);
}

export function getSessionToken(cookie: string | null | undefined): string | null {
  return getSessionTokens(cookie)[0] ?? null;
}

export function hasSessionToken(cookie: string | null | undefined): boolean {
  return getSessionToken(cookie) !== null;
}
