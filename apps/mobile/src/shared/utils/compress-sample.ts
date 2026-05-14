import { gzipToBase64 } from "~/utils/gzip-base64";

/**
 * Gzip-compress and base64-encode the `sample` field of a measurement payload.
 */
export function compressSample(sample: unknown): string {
  const json = typeof sample === "string" ? sample : JSON.stringify(sample);
  return gzipToBase64(json);
}
