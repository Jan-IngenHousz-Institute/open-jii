import type { Stimulus } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

/** A sweep's points: numbers for an instrument, and labels too when the operator drives it. */
export type SetpointValue = Extract<Stimulus, { operator: string }>["values"][number];

/** The most points a sweep may hold, as the procedure contract counts them. */
export const MAX_SETPOINTS = 64;

/** An instrument can only be driven to numbers, so the operator's labels drop out when one takes over. */
export function numericSetpoints(values: SetpointValue[]): number[] {
  return values.flatMap((value) => (typeof value === "number" ? [value] : []));
}

/**
 * A label is written quoted when it would not read back as itself: one holding a comma, a
 * quote or a brace, one with outer spaces, or one that would parse as a number.
 */
function formatSetpoint(value: SetpointValue): string {
  if (typeof value !== "string") {
    return typeof value === "number" ? String(value) : JSON.stringify(value);
  }

  const isAmbiguous =
    /[,"{}]/.test(value) || value.trim() !== value || Number.isFinite(Number(value));
  return isAmbiguous ? JSON.stringify(value) : value;
}

export function formatSetpoints(values: SetpointValue[]): string {
  return values.map(formatSetpoint).join(", ");
}

/** Commas inside a quoted label or a compound setup belong to it, not between points. */
function splitPoints(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let isQuoted = false;
  let isEscaped = false;
  let start = 0;

  for (let at = 0; at < text.length; at++) {
    const char = text.charAt(at);

    if (isQuoted) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        isQuoted = false;
      }
      continue;
    }

    if (char === '"') {
      isQuoted = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
    } else if (char === "," && depth === 0) {
      parts.push(text.slice(start, at));
      start = at + 1;
    }
  }

  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

/** A compound setup: named settings, each a number or a label. */
function parseCompound(part: string): SetpointValue | null {
  const parsed: unknown = JSON.parse(part);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const settings: Record<string, string | number> = {};
  for (const [name, setting] of Object.entries(parsed)) {
    if (typeof setting !== "string" && typeof setting !== "number") {
      return null;
    }
    settings[name] = setting;
  }
  return settings;
}

function parseSetpoint(part: string, numbersOnly: boolean): SetpointValue | null {
  const asNumber = Number(part);
  if (Number.isFinite(asNumber)) {
    return asNumber;
  }
  if (numbersOnly) {
    return null;
  }

  try {
    if (part.startsWith("{")) {
      return parseCompound(part);
    }
    if (part.startsWith('"')) {
      const label: unknown = JSON.parse(part);
      return typeof label === "string" && label !== "" ? label : null;
    }
  } catch {
    // A brace or quote not yet closed is a point still being typed.
    return null;
  }

  return part;
}

/**
 * The list as `formatSetpoints` writes it, back into setpoints, or null when any entry is
 * not one yet.
 *
 * Null rather than a partial list: committing "0.8, " as a single point would silently drop
 * what the author was still typing.
 */
export function parseSetpoints(text: string, numbersOnly: boolean): SetpointValue[] | null {
  const parts = splitPoints(text);
  if (parts.length === 0 || parts.length > MAX_SETPOINTS) {
    return null;
  }

  const values: SetpointValue[] = [];
  for (const part of parts) {
    const value = parseSetpoint(part, numbersOnly);
    if (value === null) {
      return null;
    }
    values.push(value);
  }

  return values;
}
