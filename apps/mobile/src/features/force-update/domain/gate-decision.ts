import type { PageForceUpdateFieldsFragment } from "@repo/cms/lib/__generated/sdk";

import { isVersionBelow } from "./compare-version";

// A gate blocks the app when it is active, its effectiveAt (if any) has
// passed, and the running version is below minVersion.
export function isUpdateRequired(
  gate: PageForceUpdateFieldsFragment | null,
  runningVersion: string,
  now: Date,
): boolean {
  if (gate?.active !== true) return false;
  if (gate.effectiveAt && new Date(gate.effectiveAt as string) > now) return false;
  return gate.minVersion ? isVersionBelow(runningVersion, gate.minVersion) : false;
}
