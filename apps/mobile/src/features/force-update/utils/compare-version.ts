// Tiny semver comparator — the repo has no `semver` dep and gate versions are plain `major.minor.patch`.

/**
 * Parse the `major.minor.patch` core of a version, ignoring any `-prerelease`
 * or `+build` suffix and padding missing segments with zero. Returns `null` for
 * anything that isn't up to three non-negative integer segments — callers treat
 * `null` as "can't compare".
 */
function parseVersion(value: string): [number, number, number] | null {
  const core = value.trim().split(/[-+]/)[0];
  if (!core) return null;
  const segments = core.split(".");
  if (segments.length > 3) return null;
  // Number("") is 0, so "1..2" or ".1" would otherwise parse as valid.
  if (segments.some((s) => !/^\d+$/.test(s))) return null;
  const nums = segments.map((s) => Number(s));
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
}

/**
 * Returns `true` when `current` is strictly below `minimum`.
 *
 * Fail-safe: if either version can't be parsed it returns `false`, so a
 * malformed value can never lock a user out of the app.
 */
export function isVersionBelow(current: string, minimum: string): boolean {
  const c = parseVersion(current);
  const m = parseVersion(minimum);
  if (!c || !m) return false;
  for (let i = 0; i < 3; i++) {
    if (c[i] < m[i]) return true;
    if (c[i] > m[i]) return false;
  }
  return false;
}
