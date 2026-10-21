import * as SecureStore from "expo-secure-store";
import { sessionGeneration } from "~/features/auth/services/session-cache";
import { getEnvVar, useEnvVar } from "~/shared/stores/environment-store";

import { createOpenJiiAuthClient } from "@repo/auth/client.native";

const authClients: Record<
  string,
  { generation: number; client: ReturnType<typeof createOpenJiiAuthClient> }
> = {};

function clientFor(backendUri: string) {
  const generation = sessionGeneration();
  const cached = authClients[backendUri];
  if (cached?.generation === generation) return cached.client;
  // A response from a departed identity cannot write its cookie or session back.
  const client = createOpenJiiAuthClient(backendUri, {
    getItem: (key) => (generation === sessionGeneration() ? SecureStore.getItem(key) : null),
    setItem: (key, value) => {
      if (generation === sessionGeneration()) SecureStore.setItem(key, value);
    },
  });
  authClients[backendUri] = { generation, client };
  return client;
}

export function useAuthClient() {
  return clientFor(useEnvVar("BACKEND_URI"));
}

export function getAuthClient() {
  return clientFor(getEnvVar("BACKEND_URI"));
}

// Tests that swap BACKEND_URI or assert client construction reset here
// (same convention as aws-iot-auth's _reset*ForTests).
export function _resetAuthClientsForTests(): void {
  for (const key of Object.keys(authClients)) {
    delete authClients[key];
  }
}
