import type { CalibrationDefinitionSummary } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

/**
 * A name is one version line. Creating a definition under an existing name adds a version
 * to that line rather than replacing it, and a run records the version it ran, so every
 * version stays readable forever. The library lists lines, not versions.
 */
export interface CalibrationVersionLine {
  name: string;
  /** Newest first, so the head of a line is its current version. */
  versions: CalibrationDefinitionSummary[];
  latest: CalibrationDefinitionSummary;
}

export function toVersionLines(
  definitions: CalibrationDefinitionSummary[],
): CalibrationVersionLine[] {
  const byName = new Map<string, CalibrationDefinitionSummary[]>();
  for (const definition of definitions) {
    const versions = byName.get(definition.name) ?? [];
    versions.push(definition);
    byName.set(definition.name, versions);
  }

  const lines: CalibrationVersionLine[] = [];
  for (const [name, versions] of byName) {
    const ordered = [...versions].sort((left, right) => right.version - left.version);
    lines.push({ name, versions: ordered, latest: ordered[0] });
  }

  // Most recently worked on first: a line's newest version is the one that moved it.
  return lines.sort(
    (left, right) =>
      new Date(right.latest.updatedAt).getTime() - new Date(left.latest.updatedAt).getTime(),
  );
}
