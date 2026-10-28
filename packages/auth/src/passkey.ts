/**
 * Its own entry rather than part of `@repo/auth/server`, so the backend can name a
 * passkey's authenticator without loading the auth instance, which tests mock.
 */
export { getAuthenticatorName } from "@better-auth/passkey";
