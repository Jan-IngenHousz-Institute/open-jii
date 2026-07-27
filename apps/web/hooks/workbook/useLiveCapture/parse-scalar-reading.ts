/**
 * Coerce one live-capture reply into a plottable scalar. MiniPAR LINE-mode
 * replies arrive already JSON-parsed (`par` -> number); string replies from
 * other firmwares are parsed here. Structured replies (JSON-mode envelopes,
 * arrays) are not scalars and yield null so the caller can skip the point
 * without stopping the loop.
 */
export function parseScalarReading(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    // Number("") is 0; an empty reply is missing data, not a zero reading.
    if (trimmed.length === 0) return null;
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}
