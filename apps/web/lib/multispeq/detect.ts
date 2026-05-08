import type { MeasurementInput } from "./pipeline";

/**
 * Recognises the shapes a MultispeQ measurement may arrive in:
 *   - Live device wrapper: { sample: [{ set: [...] } | { data_raw, ... }, ...], device_id?, ... }
 *   - PhotosynQ DB row:    { sample_raw: "[ ... v1/v2 json ... ]" } (string or array)
 *   - The v2 wrapper directly: { set: [{ data_raw, label?, ... }, ...], protocol_id?: ... }
 *   - A raw v1/v2 array: [{ set: [...] }] or [{ data_raw, ... }, ...]
 */
export function isMultispeqOutput(data: unknown): boolean {
  return extractMeasurement(data) != null;
}

export function extractMeasurement(data: unknown): MeasurementInput | null {
  if (data == null || typeof data !== "object") return null;

  if (Array.isArray(data)) {
    return looksLikeSampleRaw(data) ? { sample_raw: data } : null;
  }

  const obj = data as Record<string, unknown>;

  if ("sample_raw" in obj) {
    const raw = obj.sample_raw;
    if (typeof raw === "string" || Array.isArray(raw)) {
      return {
        measurement_id: typeof obj.measurement_id === "string" ? obj.measurement_id : null,
        project_id: typeof obj.project_id === "string" ? obj.project_id : null,
        sample_raw: raw,
      };
    }
  }

  // Live MultispeQ device output uses `sample` for the same payload.
  if (Array.isArray(obj.sample) && looksLikeSampleRaw(obj.sample)) {
    return {
      measurement_id: typeof obj.measurement_id === "string" ? obj.measurement_id : null,
      project_id: typeof obj.project_id === "string" ? obj.project_id : null,
      sample_raw: obj.sample,
    };
  }

  if (Array.isArray(obj.set) && obj.set.some(hasDataRaw)) {
    return { sample_raw: [obj] };
  }

  return null;
}

function looksLikeSampleRaw(items: unknown[]): boolean {
  if (items.length === 0) return false;
  const first = items[0];
  if (!first || typeof first !== "object") return false;
  const f = first as Record<string, unknown>;
  if (Array.isArray(f.set) && f.set.some(hasDataRaw)) return true;
  return hasDataRaw(first);
}

function hasDataRaw(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const dr = (item as Record<string, unknown>).data_raw;
  return Array.isArray(dr);
}
