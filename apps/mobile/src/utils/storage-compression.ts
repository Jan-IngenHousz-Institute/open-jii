import { base64ToGunzip, gzipToBase64 } from "~/utils/gzip-base64";

const COMPRESSED_PREFIX = "gz:";

/**
 * Gzip-compress a JSON-serializable value for AsyncStorage.
 * The result is prefixed with "gz:" so readers can distinguish
 * compressed entries from legacy uncompressed ones.
 */
export function compressForStorage(value: unknown): string {
  const json = JSON.stringify(value);
  return COMPRESSED_PREFIX + gzipToBase64(json);
}

/**
 * Decompress a value previously stored with `compressForStorage`.
 * Also handles legacy uncompressed JSON strings transparently.
 */
export function decompressFromStorage<T>(stored: string): T {
  if (stored.startsWith(COMPRESSED_PREFIX)) {
    const base64 = stored.slice(COMPRESSED_PREFIX.length);
    const json = base64ToGunzip(base64);
    return JSON.parse(json) as T;
  }

  // Legacy uncompressed entry
  return JSON.parse(stored) as T;
}
