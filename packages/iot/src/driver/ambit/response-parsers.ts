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

/** Six ADPD channels, each a 24-bit dark count. */
export const BASELINE_CHANNELS = 6;
export const BASELINE_MAX_COUNT = 0xff_ffff;

/**
 * `baseline`: the first line that is exactly six ADPD counts. The lines the
 * firmware prints ahead of the vector vary, so they are skipped rather than
 * matched.
 */
export function parseBaselineReply(text: string): number[] | null {
  for (const line of text.split("\n")) {
    const fields = line.split(",").map((field) => field.trim());
    if (fields.length !== BASELINE_CHANNELS) {
      continue;
    }

    const isVector = fields.every(
      (field) => /^\d+$/.test(field) && Number(field) <= BASELINE_MAX_COUNT,
    );

    if (isVector) {
      return fields.map((field) => Number(field));
    }
  }

  return null;
}

/** One `arrun2` channel buffer: `Data:<tag>,Length:N` TAB csv counts. */
const ARRUN2_DATA_LINE = /^Data:([^,]+),Length:(\d+)\t(.*)$/;

/**
 * `arrun2`: one entry per channel buffer, keyed by the line's tag. A payload that
 * is not all numbers, or that holds fewer counts than the line says it does, is
 * kept as its text: a short buffer read as a whole one is a silent measurement
 * error, while the text shows the bench what arrived. The terminator line carries
 * no buffer and is skipped.
 */
export function parseArrun2Reply(text: string): Record<string, number[] | string> | null {
  const channels: Record<string, number[] | string> = {};

  for (const line of text.split("\n")) {
    const match = ARRUN2_DATA_LINE.exec(line.trim());
    if (!match) {
      continue;
    }

    const tag = match[1];
    const declaredLength = Number(match[2]);
    const payload = match[3];
    const counts = payload
      .split(",")
      .map((field) => field.trim())
      .filter((field) => field.length > 0)
      .map((field) => Number(field));
    const isComplete =
      counts.length === declaredLength && counts.every((count) => Number.isFinite(count));

    channels[tag] = isComplete ? counts : payload;
  }

  return Object.keys(channels).length > 0 ? channels : null;
}

/** A structured reply, or the bare vector a baseline reads back. */
type AmbitParsedReply = Record<string, unknown> | number[];

/** Parser table keyed by the command's leading token. */
export const AMBIT_REPLY_PARSERS: Partial<
  Record<string, (text: string) => AmbitParsedReply | null>
> = {
  get_par: parseParReply,
  PAR: parseParReply,
  temp: parseTempReply,
  baseline: parseBaselineReply,
  arrun2: parseArrun2Reply,
};
