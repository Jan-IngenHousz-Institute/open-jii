import type { MacroOutput } from "~/shared/measurements/macro-output";

/**
 * One field of a macro's output, sorted into how it should be shown.
 *  - `chart`: a numeric series, the visual payload of a run
 *  - `value`: a scalar worth reading at a glance
 *  - `empty`: the macro produced the field but had no value for it
 *  - `other`: structured output (objects, text lists) kept verbatim
 */
export type MacroField =
  | { kind: "chart"; name: string; values: (number | null)[] }
  | { kind: "value"; name: string; value: string }
  | { kind: "empty"; name: string }
  | { kind: "other"; name: string; json: string };

export interface PartitionedMacroOutput {
  charts: Extract<MacroField, { kind: "chart" }>[];
  values: Extract<MacroField, { kind: "value" }>[];
  empties: Extract<MacroField, { kind: "empty" }>[];
  others: Extract<MacroField, { kind: "other" }>[];
  /** True when the macro returned no field at all (beyond messages). */
  isEmpty: boolean;
}

/**
 * Splits macro outputs into what the result view draws. Every field lands in
 * exactly one bucket: a macro that reports 20 fields and measures none must
 * read as "20 fields, no value", not as a blank screen.
 */
export function partitionMacroOutput(outputs: MacroOutput[] | undefined): PartitionedMacroOutput {
  const charts: PartitionedMacroOutput["charts"] = [];
  const values: PartitionedMacroOutput["values"] = [];
  const empties: PartitionedMacroOutput["empties"] = [];
  const others: PartitionedMacroOutput["others"] = [];

  let fieldCount = 0;
  for (const output of outputs ?? []) {
    for (const name of Object.keys(output)) {
      if (name === "messages") continue;
      fieldCount++;
      const value: unknown = output[name];

      if (isEmptyValue(value)) {
        empties.push({ kind: "empty", name });
        continue;
      }
      if (Array.isArray(value)) {
        if (value.every((v) => typeof v === "number" && !Number.isNaN(v))) {
          charts.push({ kind: "chart", name, values: value as number[] });
          continue;
        }
        // A trace with gaps (null/NaN from a dropped sample) still charts —
        // the gaps render as breaks. Only genuinely mixed arrays (strings,
        // objects) fall through to the JSON dump.
        if (value.length > 0 && value.every((v) => v == null || typeof v === "number")) {
          charts.push({
            kind: "chart",
            name,
            values: value.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null)),
          });
          continue;
        }
      }
      if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
        values.push({ kind: "value", name, value: String(value) });
        continue;
      }
      others.push({ kind: "other", name, json: safeStringify(value) });
    }
  }

  return { charts, values, empties, others, isEmpty: fieldCount === 0 };
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value === "number") return Number.isNaN(value);
  return Array.isArray(value) && value.length === 0;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}
