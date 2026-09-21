import type { ProcedureRead } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { DUT_ROLE } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { uniqueName } from "./output-schema-edits";
import type { ReadSource } from "./rig-sources";

/** When nothing about a reading suggests a name. */
const FALLBACK_COLUMN = "value";

/** Every family's driver answers this, and a rig always declares the device. */
const FALLBACK_COMMAND = "hello";

/** What the operator types is the reference the device is held against. */
const OPERATOR_COLUMN = "reference";

/** A column is a payload key and a python dict key; the contract's rule for both. */
function toColumnName(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

  return /^[a-z]/.test(cleaned) ? cleaned : FALLBACK_COLUMN;
}

/**
 * What a reading calls its column before anyone renames it.
 *
 * A bench instrument is named for the job it does on the rig, so its role is the column
 * the script will want ("par_ref"). A device answers many things, so the command is what
 * tells the readings apart ("par_raw" beside "spec").
 */
export function columnForRead(read: ProcedureRead, sources: ReadSource[]): string {
  if (!("instrument" in read)) {
    return OPERATOR_COLUMN;
  }

  const source = sources.find((candidate) => candidate.role === read.instrument);
  if (source?.isExhaustive === true) {
    return toColumnName(read.instrument);
  }

  return toColumnName(read.command ?? read.instrument);
}

/**
 * The reading a step opens with, and the one an author adds next.
 *
 * A bench records the device against a reference at every point, so the next reading is
 * the role nothing in this step has asked yet. A device's command list is alphabetical
 * and its first entry is as likely to be "battery" as anything worth recording, so it
 * opens on the handshake every driver answers instead.
 */
export function defaultRead(sources: ReadSource[], taken: ProcedureRead[]): ProcedureRead {
  const asked = taken.flatMap((read) => ("instrument" in read ? [read.instrument] : []));
  const source = sources.find((candidate) => !asked.includes(candidate.role)) ?? sources.at(0);

  const read: ProcedureRead = {
    instrument: source?.role ?? DUT_ROLE,
    command:
      (source?.isExhaustive === true ? source.offered.at(0) : FALLBACK_COMMAND) ?? FALLBACK_COMMAND,
    as: "",
  };

  return {
    ...read,
    as: uniqueName(
      columnForRead(read, sources),
      taken.map((entry) => entry.as),
    ),
  };
}

/**
 * Whether the column is still the one the reading gave itself, rather than a name the
 * author chose. Only the first kind follows the reading when the source changes.
 */
export function isDefaultColumn(read: ProcedureRead, sources: ReadSource[]): boolean {
  const suggested = columnForRead(read, sources);
  return read.as === suggested || new RegExp(`^${suggested}_\\d+$`).test(read.as);
}
