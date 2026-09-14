"use client";

import { Database } from "lucide-react";
import Link from "next/link";
import { useExperimentTables } from "~/hooks/experiment/useExperimentTables/useExperimentTables";
import { useLocale } from "~/hooks/useLocale";

import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

interface ExperimentDataInventoryProps {
  experimentId: string;
  isArchived?: boolean;
}

/**
 * What data this experiment holds, table by table. The neighbouring pulse says
 * whether data is still arriving; this says what has accumulated, which is the
 * one thing the overview cannot otherwise tell you without opening the Data tab.
 */
export function ExperimentDataInventory({
  experimentId,
  isArchived = false,
}: ExperimentDataInventoryProps) {
  const { t } = useTranslation("experiments");
  const locale = useLocale();
  const { tables, isLoading, error } = useExperimentTables(experimentId);

  const dataHref = `/${locale}/platform/${isArchived ? "experiments-archive" : "experiments"}/${experimentId}/data`;
  const number = new Intl.NumberFormat(locale);
  const hasTables = tables !== undefined && tables.length > 0;

  function renderRow(table: ExperimentTableMetadata) {
    return (
      <li
        key={table.identifier}
        className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{table.displayName}</span>
          <Badge variant="secondary" className="shrink-0 font-normal">
            {t(`dataInventory.type.${table.tableType}`)}
          </Badge>
        </span>
        <span className="text-muted-foreground shrink-0 text-sm">
          <span className="tabular-nums">{number.format(table.totalRows)}</span>{" "}
          {t("dataInventory.rowUnit", { count: table.totalRows })}
        </span>
      </li>
    );
  }

  function renderBody() {
    if (isLoading) {
      return <Skeleton className="h-[172px]" />;
    }

    if (error) {
      return (
        <EmptyState
          variant="error"
          description={t("dataInventory.loadError")}
          icon={<Database aria-hidden />}
        />
      );
    }

    if (!hasTables) {
      return (
        <EmptyState
          icon={<Database aria-hidden />}
          title={t("dataInventory.emptyTitle")}
          description={t("dataInventory.empty")}
        />
      );
    }

    return (
      <Card className="overflow-hidden shadow-none">
        <CardContent className="p-0">
          <ul>{tables.map(renderRow)}</ul>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{t("dataInventory.title")}</h2>
        {hasTables && (
          <Button asChild variant="link" className="h-auto shrink-0 p-0">
            <Link href={dataHref}>{t("dataInventory.seeAll")}</Link>
          </Button>
        )}
      </div>
      {renderBody()}
    </section>
  );
}
