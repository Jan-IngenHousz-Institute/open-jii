import { getEnvVar, useEnvVar } from "~/shared/stores/environment-store";

import { createOpenJiiAuthClient } from "@repo/auth/client.native";

const authClients: Record<string, ReturnType<typeof createOpenJiiAuthClient>> = {};

export function useAuthClient() {
  const backendUri = useEnvVar("BACKEND_URI");
  authClients[backendUri] ??= createOpenJiiAuthClient(backendUri);

  return authClients[backendUri];
}

export function getAuthClient() {
  const backendUri = getEnvVar("BACKEND_URI");
  authClients[backendUri] ??= createOpenJiiAuthClient(backendUri);

  return authClients[backendUri];
}

// Tests that swap BACKEND_URI or assert client construction reset here
// (same convention as aws-iot-auth's _reset*ForTests).
export function _resetAuthClientsForTests(): void {
  for (const key of Object.keys(authClients)) {
    delete authClients[key];
  }
}
