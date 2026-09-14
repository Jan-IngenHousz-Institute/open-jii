"use client";

import { Database } from "lucide-react";
import Link from "next/link";
import { useExperimentTables } from "~/hooks/experiment/useExperimentTables/useExperimentTables";
import { useLocale } from "~/hooks/useLocale";

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

  if (isLoading) {
    return (
      <section className="space-y-3">
        <h2 className="font-bold">{t("dataInventory.title")}</h2>
        <Skeleton className="h-43" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-3">
        <h2 className="font-bold">{t("dataInventory.title")}</h2>
        <EmptyState
          variant="error"
          icon={<Database aria-hidden />}
          description={t("dataInventory.loadError")}
        />
      </section>
    );
  }

  // Narrowed here rather than through a flag, so the listing below can map it.
  if (tables === undefined || tables.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="font-bold">{t("dataInventory.title")}</h2>
        <EmptyState
          icon={<Database aria-hidden />}
          title={t("dataInventory.emptyTitle")}
          description={t("dataInventory.empty")}
        />
      </section>
    );
  }

  const dataHref = `/${locale}/platform/${isArchived ? "experiments-archive" : "experiments"}/${experimentId}/data`;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{t("dataInventory.title")}</h2>
        <Button asChild variant="link" className="h-auto shrink-0 p-0">
          <Link href={dataHref}>{t("dataInventory.seeAll")}</Link>
        </Button>
      </div>

      <Card padding="none" className="overflow-hidden shadow-none">
        <CardContent className="p-0">
          <ul>
            {tables.map((table) => (
              <ExperimentDataInventoryRow key={table.identifier} table={table} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
