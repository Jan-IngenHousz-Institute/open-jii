"use client";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";

import { ColumnSourceTag } from "./column-source-tag";

interface ColumnNameProps {
  column: Pick<ExperimentDataColumn, "name" | "renamedFrom">;
}

/** A column as people named it, tagged with its source when it had to be renamed. */
export function ColumnName({ column }: ColumnNameProps) {
  const name = useColumnLabel(column);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate">{name}</span>
      {column.renamedFrom ? (
        <ColumnSourceTag columnKey={column.name} renamedFrom={column.renamedFrom} />
      ) : null}
    </span>
  );
}

export function useColumnLabel(column: Pick<ExperimentDataColumn, "name" | "renamedFrom">): string {
  const { t } = useTranslation("common");
  if (column.name === "is_simulated") return t("provenance.simulated");
  if (column.name === "is_guest") return t("provenance.guest");
  return column.renamedFrom?.name ?? column.name;
}
