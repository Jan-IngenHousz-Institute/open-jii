// Matches better-auth.<env>.session_token and its __Secure- variant. Other
// Better Auth cookies, such as a leftover oauth_state, are not a session.
export function getSessionToken(cookie: string | null | undefined): string | null {
  return /(?:^|;\s*)[^=;]+\.session_token=([^;]+)/.exec(cookie ?? "")?.[1] ?? null;
}

export function hasSessionToken(cookie: string | null | undefined): boolean {
  return getSessionToken(cookie) !== null;
}
