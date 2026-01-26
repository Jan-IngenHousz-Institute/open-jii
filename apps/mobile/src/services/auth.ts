import { getEnvVar, useEnvVar } from "~/stores/environment-store";

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
