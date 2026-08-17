import { base64ToGunzip } from "~/shared/compression/gzip-base64";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("measurement-preview");

/**
 * Reverses the `sample` compression applied at upload time (see
 * compress-sample) so a stored payload can be fed back to a macro, which
 * expects the sample envelope rather than a gzip+base64 string. Payloads
 * without the marker are returned unchanged.
 *
 * Returns undefined when the marker is present but the sample can't be
 * restored (corrupt data, unknown encoding, marker without a string sample).
 * The caller must treat that as "unavailable": handing the still-encoded
 * payload to the macro would run it against the outer envelope and show a
 * plausible-looking but wrong result.
 */
export function decodeStoredSample(
  payload: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (payload._sample_encoding == null) {
    return payload;
  }
  if (payload._sample_encoding !== "gzip+base64" || typeof payload.sample !== "string") {
    log.warn("sample encoding marker without a decodable sample", {
      encoding: payload._sample_encoding,
    });
    return undefined;
  }
  try {
    const { _sample_encoding, ...rest } = payload;
    return { ...rest, sample: JSON.parse(base64ToGunzip(payload.sample)) };
  } catch (error) {
    log.warn("sample decode failed", { err: (error as Error)?.message });
    return undefined;
  }
}
