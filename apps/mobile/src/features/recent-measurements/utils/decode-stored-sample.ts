import { base64ToGunzip } from "~/shared/compression/gzip-base64";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("measurement-preview");

/**
 * Reverses the `sample` compression applied at upload time (see
 * compress-sample) so a stored payload can be fed back to a macro, which
 * expects the sample envelope rather than a gzip+base64 string. Payloads
 * without the marker are returned unchanged.
 */
export function decodeStoredSample(payload: Record<string, unknown>): Record<string, unknown> {
  if (payload._sample_encoding !== "gzip+base64" || typeof payload.sample !== "string") {
    return payload;
  }
  try {
    const { _sample_encoding, ...rest } = payload;
    return { ...rest, sample: JSON.parse(base64ToGunzip(payload.sample)) };
  } catch (error) {
    log.warn("sample decode failed", { err: (error as Error)?.message });
    return payload;
  }
}
