import pako from "pako";

const COMPRESSED_PREFIX = "gz:";

/**
 * Gzip-compress a JSON-serializable value for AsyncStorage.
 * The result is prefixed with "gz:" so readers can distinguish
 * compressed entries from legacy uncompressed ones.
 */
export function compressForStorage(value: unknown): string {
  const json = JSON.stringify(value);
  const compressed = pako.gzip(json);
  const binary = Array.from(compressed, (b) => String.fromCharCode(b)).join("");
  return COMPRESSED_PREFIX + btoa(binary);
}

/**
 * Decompress a value previously stored with `compressForStorage`.
 * Also handles legacy uncompressed JSON strings transparently.
 */
export function decompressFromStorage<T>(stored: string): T {
  if (stored.startsWith(COMPRESSED_PREFIX)) {
    const base64 = stored.slice(COMPRESSED_PREFIX.length);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const json = pako.ungzip(bytes, { to: "string" });
    return JSON.parse(json) as T;
  }

  // Legacy uncompressed entry
  return JSON.parse(stored) as T;
}
