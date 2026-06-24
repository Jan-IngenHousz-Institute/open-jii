"use client";

import { X } from "lucide-react";

import type { DataColumn, DataFilter } from "@repo/api/schemas/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { parentColumnName } from "../filter-column-path";
import { operatorsForColumn } from "../filter-operators";
import { ChipValue } from "./chip-value";

interface FilterChipFaceProps {
  filter: DataFilter;
  column: DataColumn | undefined;
  experimentId?: string;
  tableName?: string;
  onClick?: () => void;
  onRemove: () => void;
  fullWidth?: boolean;
  className?: string;
}

export function FilterChipFace({
  filter,
  column,
  experimentId,
  tableName,
  onClick,
  onRemove,
  fullWidth = false,
  className,
}: FilterChipFaceProps) {
  const { t } = useTranslation("common");
  const operators = operatorsForColumn(column);
  const opLabel = operators.find((o) => o.value === filter.operator)?.label ?? filter.operator;
  const isContributor = column?.type_text === WellKnownColumnTypes.CONTRIBUTOR;
  const displayColumn = parentColumnName(filter.column);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  return (
    <div
      className={cn(
        "bg-background shadow-xs inline-flex h-7 items-center rounded-md border text-xs",
        fullWidth && "flex w-full",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "hover:bg-muted/50 inline-flex h-full items-center gap-1.5 rounded-l-md px-2",
          fullWidth ? "min-w-0 flex-1 justify-start" : "min-w-0",
        )}
      >
        <span className="truncate font-medium">{displayColumn}</span>
        <span className="text-muted-foreground shrink-0">{opLabel}</span>
        <ChipValue
          filter={filter}
          isContributor={isContributor}
          fullWidth={fullWidth}
          parentColumn={displayColumn}
          experimentId={experimentId}
          tableName={tableName}
        />
      </button>
      <button
        type="button"
        onClick={handleRemove}
        className="text-muted-foreground hover:bg-muted/50 hover:text-destructive inline-flex h-full w-6 shrink-0 items-center justify-center rounded-r-md border-l"
        aria-label={t("dataFilters.removeFilterOn", { name: displayColumn })}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
