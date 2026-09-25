"use client";

import type {
  ExperimentDataColumn,
  ExperimentDataColumnSource,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

const SOURCE_LABEL_KEYS: Record<ExperimentDataColumnSource, string> = {
  macro_output: "dataColumns.sourceMacroOutput",
  questions_data: "dataColumns.sourceQuestion",
  custom_metadata: "dataColumns.sourceMetadata",
  uploaded_data: "dataColumns.sourceUpload",
};

interface ColumnSourceTagProps {
  columnKey: string;
  renamedFrom: NonNullable<ExperimentDataColumn["renamedFrom"]>;
}

/** Marks a field listed apart from the table's own column of the same name, and says why. */
export function ColumnSourceTag({ columnKey, renamedFrom }: ColumnSourceTagProps) {
  const { t } = useTranslation("common");
  // Exports lift only macro output and question fields into columns of their own.
  const isExportedAsColumn =
    renamedFrom.source === "macro_output" || renamedFrom.source === "questions_data";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="text-muted-foreground h-4 shrink-0 px-1.5 py-0 text-[10px] font-normal leading-none"
          >
            {t(SOURCE_LABEL_KEYS[renamedFrom.source])}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{t("dataColumns.renamedTooltip", { name: renamedFrom.name })}</p>
          {isExportedAsColumn ? (
            <p>{t("dataColumns.renamedExportName", { key: columnKey })}</p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
