import { isIP } from "node:net";

type RequestHeaders = Headers | Record<string, string | string[] | undefined>;

export interface ClientAddressRequest {
  headers?: RequestHeaders;
  socket?: { remoteAddress?: string };
}

export const INTERNAL_CLIENT_ADDRESS_HEADER = "x-openjii-resolved-client-address";
export const CLIENT_ADDRESS_UNAVAILABLE = {
  code: "CLIENT_ADDRESS_UNAVAILABLE",
  message: "The client address could not be verified.",
};

function canonicalAddress(value: string): string | null {
  if (value.includes("%")) return null;
  const family = isIP(value);
  if (family === 4) return value;
  if (family !== 6) return null;
  const normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([\da-f]+):([\da-f]+)$/.exec(normalized);
  if (!mapped) return normalized;
  const high = parseInt(mapped[1], 16);
  const low = parseInt(mapped[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
}

export function resolveClientAddress(
  request: ClientAddressRequest,
  mode = process.env.AUTH_CLIENT_ADDRESS_MODE,
): string | null {
  if (mode === "local") {
    return canonicalAddress(request.socket?.remoteAddress ?? "127.0.0.1");
  }
  const headers = request.headers;
  const value =
    headers instanceof Headers ? headers.get("x-forwarded-for") : headers?.["x-forwarded-for"];
  const chain = (Array.isArray(value) ? value.join(",") : (value ?? "")).split(",");
  if (chain.length < 2) return null;
  // Only the protected CloudFront -> ALB suffix is trusted. Empty positions must stay put.
  const edge = canonicalAddress(chain[chain.length - 1].trim());
  const viewer = canonicalAddress(chain[chain.length - 2].trim());
  return edge && viewer ? viewer : null;
}
