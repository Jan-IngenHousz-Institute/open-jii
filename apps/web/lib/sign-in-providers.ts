/** The providers a person can connect from Security, in the order the page lists them. */
export const CONNECTABLE_PROVIDERS = ["github", "orcid"] as const;

export type ConnectableProvider = (typeof CONNECTABLE_PROVIDERS)[number];

export const PROVIDER_NAMES: Record<ConnectableProvider, string> = {
  github: "GitHub",
  orcid: "ORCID",
};

/** Marks where Security is reached after a link, with the provider as its value. */
export const CONNECTED_PARAM = "connected";
/** Marks where Better Auth's error redirect lands, with the provider as its value. */
export const CONNECT_ERROR_PARAM = "connect";

/**
 * Better Auth's own names for what it appends to its error redirect, not ours to rename:
 * its error code, and a description beside it when the provider sent one.
 */
export const ERROR_PARAM = "error";
export const ERROR_DESCRIPTION_PARAM = "error_description";

/** Everything the connect result adds to Security's URL, cleared once it has been read. */
export const CONNECT_RESULT_PARAMS = [
  CONNECTED_PARAM,
  CONNECT_ERROR_PARAM,
  ERROR_PARAM,
  ERROR_DESCRIPTION_PARAM,
] as const;

export function isConnectableProvider(value: unknown): value is ConnectableProvider {
  return CONNECTABLE_PROVIDERS.some((provider) => provider === value);
}
