"use client";

import { Database } from "lucide-react";
import Link from "next/link";
import { useExperimentTables } from "~/hooks/experiment/useExperimentTables/useExperimentTables";
import { useLocale } from "~/hooks/useLocale";

import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { ExperimentDataInventoryRow } from "./experiment-data-inventory-row";

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
  const hasTables = tables !== undefined && tables.length > 0;

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

      <DataInventoryBody isLoading={isLoading} hasError={!!error} tables={tables ?? []} />
    </section>
  );
}

interface DataInventoryBodyProps {
  isLoading: boolean;
  hasError: boolean;
  tables: ExperimentTableMetadata[];
}

function DataInventoryBody({ isLoading, hasError, tables }: DataInventoryBodyProps) {
  const { t } = useTranslation("experiments");

  if (isLoading) {
    return <Skeleton className="h-[172px]" />;
  }

  if (hasError) {
    return (
      <EmptyState
        variant="error"
        icon={<Database aria-hidden />}
        description={t("dataInventory.loadError")}
      />
    );
  }

  if (tables.length === 0) {
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
        <ul>
          {tables.map((table) => (
            <ExperimentDataInventoryRow key={table.identifier} table={table} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
