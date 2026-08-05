import type { OutputDeviceResult } from "@repo/api/domains/workbook/workbook-cells.schema";
import { presentDevice } from "@repo/api/transforms/device-presentation";

import type { DeviceOutcome } from "../ports";

/**
 * Per-device outcomes collapsed into one output-entry shape, mirroring web's
 * multi-device semantics: a single device keeps the exact legacy flat shape;
 * several devices additionally carry `deviceResults`, with failures listed as
 * messages. Partial failure still succeeds (the good data is usable); total
 * failure fails with the first device's error.
 */
export type CollapsedOutcomes =
  | { ok: true; v: unknown; deviceResults?: OutputDeviceResult[]; messages?: string[] }
  | { ok: false; error: string; deviceResults?: OutputDeviceResult[]; messages?: string[] };

function resultDisplayLabel(result: DeviceOutcome): string {
  const presentation = presentDevice({ name: result.deviceName, family: result.family });
  const primary =
    presentation.provenance === "fallback" ? result.deviceLabel : presentation.primary;
  const secondary = [
    presentation.provenance === "name" ? presentation.productName : null,
    result.deviceLabel,
  ]
    .filter((value): value is string => value != null && value !== primary)
    .filter((value, index, values) => values.indexOf(value) === index);
  return [primary, ...secondary].join(" · ");
}

export function collapseOutcomes(
  outcomes: DeviceOutcome[],
  fallbackMessage: string,
): CollapsedOutcomes {
  if (outcomes.length === 0) {
    return { ok: false, error: fallbackMessage };
  }
  const successes = outcomes.filter((o) => o.error === undefined);
  const failures = outcomes.filter((o) => o.error !== undefined);
  const isMulti = outcomes.length > 1;
  const messages = isMulti ? failures.map((f) => `${resultDisplayLabel(f)}: ${f.error}`) : [];

  if (successes.length === 0) {
    return {
      ok: false,
      error: failures[0]?.error ?? fallbackMessage,
      deviceResults: outcomes,
      messages: messages.length > 0 ? messages : undefined,
    };
  }
  return {
    ok: true,
    v: successes[0].data,
    deviceResults: outcomes,
    messages,
  };
}
