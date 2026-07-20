import type { AmbitParReading, AmbitTempReading } from "./interface";

/**
 * Upgrades known raw text replies into structured objects. Unknown commands
 * (and unparseable replies) pass through as the raw text.
 */

/** `get_par`/`PAR`: line 1 = PAR float, line 2 = 10 CSV spectral counts. */
export function parseParReply(text: string): AmbitParReading | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 1) return null;
  const par = Number(lines[0]);
  if (Number.isNaN(par)) return null;
  const channels = (lines[1] ?? "")
    .split(",")
    .map((c) => Number(c.trim()))
    .filter((n) => !Number.isNaN(n));
  return { par, channels };
}

/** `temp`: three tab-separated floats (object, ambient, object raw). */
export function parseTempReply(text: string): AmbitTempReading | null {
  const parts = text
    .trim()
    .split(/\t+/)
    .map((p) => Number(p.trim()));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return { objectC: parts[0], ambientC: parts[1], objectRawC: parts[2] };
}

/** Parser table keyed by the command's leading token. */
export const AMBIT_REPLY_PARSERS: Partial<
  Record<string, (text: string) => Record<string, unknown> | null>
> = {
  get_par: parseParReply,
  PAR: parseParReply,
  temp: parseTempReply,
};
