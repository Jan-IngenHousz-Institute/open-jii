/** The providers a person can connect from Security, in the order the page lists them. */
export const CONNECTABLE_PROVIDERS = ["github", "orcid"] as const;

export type ConnectableProvider = (typeof CONNECTABLE_PROVIDERS)[number];

export const PROVIDER_NAMES: Record<ConnectableProvider, string> = {
  github: "GitHub",
  orcid: "ORCID",
};

export function isConnectableProvider(value: unknown): value is ConnectableProvider {
  return CONNECTABLE_PROVIDERS.some((provider) => provider === value);
}
