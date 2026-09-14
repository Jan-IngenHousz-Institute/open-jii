"use client";

import { useLocale } from "~/hooks/useLocale";
import { datasetLabel } from "~/util/dataset-label";

import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";

interface ExperimentDataInventoryRowProps {
  table: ExperimentTableMetadata;
}

/** One table the experiment holds: what it is called and how big it is. */
export function ExperimentDataInventoryRow({ table }: ExperimentDataInventoryRowProps) {
  const { t } = useTranslation("experiments");
  const locale = useLocale();

  return (
    <li className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
      <span className="truncate font-medium">{datasetLabel(table)}</span>

      <span className="text-muted-foreground shrink-0 text-xs">
        <span className="tabular-nums">
          {new Intl.NumberFormat(locale).format(table.totalRows)}
        </span>{" "}
        {t("dataInventory.rowUnit", { count: table.totalRows })}
      </span>
    </li>
  );
}
