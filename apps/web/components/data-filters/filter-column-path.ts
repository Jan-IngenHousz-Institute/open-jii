import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";

/** Wire-ready dotted path; struct columns route through their identity sub-field. */
export function filterColumnPathFor(column: DataColumn): string {
  if (column.type_text === WellKnownColumnTypes.CONTRIBUTOR) {
    return `${column.name}.id`;
  }
  return column.name;
}

export function parentColumnName(filterColumn: string): string {
  const dot = filterColumn.indexOf(".");
  return dot === -1 ? filterColumn : filterColumn.slice(0, dot);
}
