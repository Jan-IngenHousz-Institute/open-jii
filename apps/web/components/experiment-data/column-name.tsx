"use client";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { ColumnSourceTag } from "./column-source-tag";

interface ColumnNameProps {
  column: Pick<ExperimentDataColumn, "name" | "renamedFrom">;
}

/** A column as people named it, tagged with its source when it had to be renamed. */
export function ColumnName({ column }: ColumnNameProps) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate">{column.renamedFrom?.name ?? column.name}</span>
      {column.renamedFrom ? (
        <ColumnSourceTag columnKey={column.name} renamedFrom={column.renamedFrom} />
      ) : null}
    </span>
  );
}
