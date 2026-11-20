import * as SecureStore from "expo-secure-store";
import { getEnvVar, useEnvVar } from "~/shared/stores/environment-store";

import { createOpenJiiAuthClient } from "@repo/auth/client.native";

const authClients: Record<string, ReturnType<typeof createOpenJiiAuthClient>> = {};

export function useAuthClient() {
  const backendUri = useEnvVar("BACKEND_URI");
  authClients[backendUri] ??= createOpenJiiAuthClient(backendUri, SecureStore);

  return authClients[backendUri];
}

export function getAuthClient() {
  const backendUri = getEnvVar("BACKEND_URI");
  authClients[backendUri] ??= createOpenJiiAuthClient(backendUri, SecureStore);

  return authClients[backendUri];
}

/**
 * Re-reads the session from the database, past the server's one-day cookie cache, straight into
 * the atom `useSession` renders from. Resolves with the user, or null when the read failed.
 */
export async function reloadSessionFromServer() {
  const sessionAtom = getAuthClient().$store.atoms.session;
  await sessionAtom.get().refetch({ query: { disableCookieCache: true } });
  const { data, error } = sessionAtom.get();
  return error ? null : (data?.user ?? null);
}

// Tests that swap BACKEND_URI or assert client construction reset here
// (same convention as aws-iot-auth's _reset*ForTests).
export function _resetAuthClientsForTests(): void {
  for (const key of Object.keys(authClients)) {
    delete authClients[key];
  }
}
