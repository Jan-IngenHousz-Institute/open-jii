import type { ProcedureRead } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { DUT_ROLE } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { uniqueName } from "./output-schema-edits";
import type { ReadSource } from "./rig-sources";

/** When nothing about a reading suggests a name. */
const FALLBACK_COLUMN = "value";

/** Every family's driver answers this, and a rig always declares the device. */
export const FALLBACK_COMMAND = "hello";

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

/** An instrument is named by its rig role; a device answers many things, so by its command. */
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

/** Opens on the role nothing has asked yet; a device's alphabetical first command is rarely the one wanted. */
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

/** A generated column follows the reading when its source changes; an author's chosen name does not. */
export function isDefaultColumn(read: ProcedureRead, sources: ReadSource[]): boolean {
  const suggested = columnForRead(read, sources);
  return read.as === suggested || new RegExp(`^${suggested}_\\d+$`).test(read.as);
}
