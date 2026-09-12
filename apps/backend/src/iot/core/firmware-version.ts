/**
 * Compare dotted numeric versions ("1.1.3", "1.03"). Devices report only the numeric
 * core, so a release suffix is not compared; a missing patch is zero.
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
