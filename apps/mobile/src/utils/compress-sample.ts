import pako from "pako";

/**
 * Gzip-compress and base64-encode the `sample` field of a measurement payload.
 */
export function compressSample(sample: unknown): string {
  const json = typeof sample === "string" ? sample : JSON.stringify(sample);
  const compressed = pako.gzip(json);

  // Convert Uint8Array → base64 via binary string (works in Hermes / JSC)
  let binary = "";
  for (const byte of compressed) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
