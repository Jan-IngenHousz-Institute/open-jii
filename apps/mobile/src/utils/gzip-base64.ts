import pako from "pako";

/**
 * Gzip-compress a string and return the result as a base64 string.
 * Works in Hermes / JSC runtimes (no Node Buffer needed).
 */
export function gzipToBase64(input: string): string {
  const compressed = pako.gzip(input);
  const binary = Array.from(compressed, (b) => String.fromCharCode(b)).join("");
  return btoa(binary);
}

/**
 * Decode a base64-encoded gzip payload back to the original string.
 */
export function base64ToGunzip(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return pako.ungzip(bytes, { to: "string" });
}
