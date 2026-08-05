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

export function nextBranchPathColor(existingColors: string[]): string {
  const assigned = new Set(existingColors.filter(Boolean).map((color) => color.toLowerCase()));
  return (
    BRANCH_PATH_COLORS.find((color) => !assigned.has(color.toLowerCase())) ??
    BRANCH_PATH_COLORS[existingColors.length % BRANCH_PATH_COLORS.length]
  );
}

export function resolveBranchPathColor(color: string | undefined, pathIndex: number): string {
  const assignedColor = color?.trim();
  if (assignedColor) return assignedColor;
  return BRANCH_PATH_COLORS[pathIndex % BRANCH_PATH_COLORS.length];
}
