"use client";

import { useLocale } from "~/hooks/useLocale";

import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

interface ExperimentDataInventoryRowProps {
  table: ExperimentTableMetadata;
}

/** One table the experiment holds: what it is called, what kind it is, how big it is. */
export function ExperimentDataInventoryRow({ table }: ExperimentDataInventoryRowProps) {
  const { t } = useTranslation("experiments");
  const locale = useLocale();

  return (
    <li className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium">{table.displayName}</span>
        <Badge variant="secondary" className="shrink-0 font-normal">
          {t(`dataInventory.type.${table.tableType}`)}
        </Badge>
      </span>

      <span className="text-muted-foreground shrink-0 text-sm">
        <span className="tabular-nums">
          {new Intl.NumberFormat(locale).format(table.totalRows)}
        </span>{" "}
        {t("dataInventory.rowUnit", { count: table.totalRows })}
      </span>
    </li>
  );
}
