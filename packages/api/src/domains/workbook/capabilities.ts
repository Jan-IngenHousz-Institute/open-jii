/**
 * Client capability handshake for workbook-version fetches.
 *
 * A dynamic command cell (an authored `{ kind: "ref" }` command source) cannot
 * be parsed by an old client whose strict command schema only knows the static
 * `{ format, content }` shape. Rather than trust the fail-open CMS force-update
 * gate, the server refuses to hand a dynamic workbook version to a client that
 * has not advertised support through this header. See the technical plan,
 * section 8.
 */

/** Header carrying the space/comma-separated capability tokens a client supports. */
export const OPENJII_CAPABILITIES_HEADER = "x-openjii-capabilities";

/** Capability a client advertises once it can parse and run `{ kind: "ref" }` commands. */
export const DYNAMIC_COMMAND_REF_CAPABILITY = "dynamic-command-ref-v1";

/** Parse a raw capabilities header value into a set of tokens. */
export function parseCapabilities(header: string | string[] | undefined | null): Set<string> {
  if (!header) return new Set();
  const raw = Array.isArray(header) ? header.join(",") : header;
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0),
  );
}

/** True when the raw header advertises the given capability token. */
export function hasCapability(
  header: string | string[] | undefined | null,
  capability: string,
): boolean {
  return parseCapabilities(header).has(capability);
}
