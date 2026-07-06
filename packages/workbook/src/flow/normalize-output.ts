/**
 * The single normalization between a raw executor response and the view that
 * branch conditions and ctx read. Extracted from mobile's hydrate-cells sample
 * unwrap so the same authored condition resolves identically on every host:
 * a `{ sample }` envelope becomes the sample array (scalars boxed), anything
 * else passes through. `resolveConditionValue` then reads `data[0][field]`
 * for arrays and `data[field]` otherwise.
 */
export function normalizeOutputData(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object") return raw;
  const sample = (raw as { sample?: unknown }).sample;
  if (sample != null) return Array.isArray(sample) ? sample : [sample];
  return raw;
}
