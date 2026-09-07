/**
 * Compare two dotted numeric firmware versions ("1.1.3", "1.03").
 *
 * Devices report only the numeric core, so a release's prerelease suffix is
 * not part of the comparison: release 1.1.3-rc1 is device-visible 1.1.3.
 * Families disagree on how many parts they report; a missing patch compares
 * as zero, so "1.03" and "1.03.0" are the same version.
 *
 * Returns a negative number when `a` precedes `b`, zero when equivalent, and a
 * positive number when `a` follows `b`. Null when either side is unparseable,
 * so callers decide what an unknown version means rather than assuming.
 */
export function compareFirmwareVersions(a: string, b: string): number | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) {
    return null;
  }

  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

function parseVersion(value: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(value.trim());
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match.at(3) ?? "0")];
}
