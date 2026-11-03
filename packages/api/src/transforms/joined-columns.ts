import type { ExperimentDataColumn } from "../domains/experiment/data/experiment-data.schema";
import { getColumnKind } from "./column-type-utils";

/** Stable keys shared by the SQL projection and every chart column picker. */
export function joinedColumns(
  primary: { name: string }[],
  secondary: ExperimentDataColumn[],
  tableName: string,
) {
  const used = new Set(primary.map((column) => column.name.toLowerCase()));
  return secondary.map((column) => {
    const base = `second__${column.name.replace(/[^A-Za-z0-9_]/g, "_")}`;
    let name = base;
    let suffix = 2;
    while (used.has(name.toLowerCase())) name = `${base}_${suffix++}`;
    used.add(name.toLowerCase());
    return { ...column, name, sourceTable: { tableName, columnName: column.name } };
  });
}

export function isJoinMatchColumn(column: ExperimentDataColumn): boolean {
  const type = column.type_text.toUpperCase();
  const kind = getColumnKind(type);
  return kind !== undefined && kind !== "complex" && !type.startsWith("STRUCT");
}
