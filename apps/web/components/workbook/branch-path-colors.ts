/**
 * Workbook cell accents, reused so branch paths stay visually aligned with the
 * rest of the editor while remaining distinct within one branch.
 */
export const BRANCH_PATH_COLORS = [
  "#005E5E",
  "#6C5CE7",
  "#119DA4",
  "#C58AAE",
  "#6F8596",
  "#D08A3C",
] as const;

interface BranchPathColorSource {
  id: string;
  color?: string;
}

function pathColorIndex(pathId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < pathId.length; index++) {
    hash ^= pathId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % BRANCH_PATH_COLORS.length;
}

export function nextBranchPathColor(existingPaths: BranchPathColorSource[]): string {
  const assigned = new Set(
    existingPaths.map((path) => resolveBranchPathColor(path.color, path.id).toLowerCase()),
  );
  return (
    BRANCH_PATH_COLORS.find((color) => !assigned.has(color.toLowerCase())) ??
    BRANCH_PATH_COLORS[existingPaths.length % BRANCH_PATH_COLORS.length]
  );
}

export function resolveBranchPathColor(color: string | undefined, pathId: string): string {
  const assignedColor = color?.trim();
  if (assignedColor) return assignedColor;
  return BRANCH_PATH_COLORS[pathColorIndex(pathId)];
}
