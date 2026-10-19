// Matches better-auth.<env>.session_token and its __Secure- variant. Other
// Better Auth cookies, such as a leftover oauth_state, are not a session.
export function hasSessionToken(cookie: string | null | undefined): boolean {
  return /(?:^|;\s*)[^=;]+\.session_token=[^;]+/.test(cookie ?? "");
}
