import { useEnvironmentStore } from "~/stores/environment-store";

/**
 * Returns true when the app is running in a non-production environment (e.g. dev).
 * Returns false when in production or before environment has been loaded.
 */
export function useIsDevelopment(): boolean {
  const environment = useEnvironmentStore((state) => state.environment);
  const isLoaded = useEnvironmentStore((state) => state.isLoaded);

  if (!isLoaded) {
    return false;
  }

  return environment !== "prod";
}
