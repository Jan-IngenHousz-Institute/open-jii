import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

export type CellType = WorkbookCell["type"];

/**
 * Single source of truth for workbook cell theming. Every cell component, the
 * add-cell menu and the sidebar read their accent from here so a colour only
 * ever needs to change in one place.
 */
export const CELL_ACCENT: Record<CellType, string> = {
  protocol: "#2D3142",
  macro: "#6C5CE7",
  command: "#119DA4",
  question: "#C58AAE",
  branch: "#F29D38",
  markdown: "#6F8596",
  output: "#94A3B8",
};

/** Light tint of {@link CELL_ACCENT}, used for active/selected sidebar rows. */
export const CELL_ACTIVE_BG: Partial<Record<CellType, string>> = {
  protocol: "#EAEBEE",
  macro: "#F1EFFD",
  command: "#E7F6F6",
  question: "#F9F3F6",
  branch: "#FBF3EA",
  markdown: "#F1F3F5",
};
