"use client";

import {
  getWorkbookCellSummary,
  WorkbookCellSummary,
} from "@/components/workbook/workbook-cell-summary";
import { WorkbookVersionBadge } from "@/components/workbook/workbook-version-badge";
import { useLocale } from "@/hooks/useLocale";
import { useWorkbook } from "@/hooks/workbook/useWorkbook/useWorkbook";
import { useWorkbookVersions } from "@/hooks/workbook/useWorkbookVersions/useWorkbookVersions";
import { formatDate } from "@/util/date";
import { BookOpen } from "lucide-react";
import Link from "next/link";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardTitle } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

interface ExperimentLinkedWorkbookProps {
  workbookId: string | null;
  workbookVersionId?: string | null;
}

export function ExperimentLinkedWorkbook({
  workbookId,
  workbookVersionId,
}: ExperimentLinkedWorkbookProps) {
  const { t } = useTranslation("workbook");
  const locale = useLocale();
  const { data: workbook, isLoading } = useWorkbook(workbookId ?? "", {
    enabled: !!workbookId,
  });
  const { data: versionsData } = useWorkbookVersions(workbookId ?? "", {
    enabled: !!workbookId,
  });

  // Find the version number for the pinned version
  const versionsList = versionsData;
  const pinnedVersion = versionsList?.find((v) => v.id === workbookVersionId);
  const latestVersion = versionsList?.[0];

  if (!workbookId) return null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CardTitle>{t("workbooks.workbook")}</CardTitle>
        <Skeleton className="h-[120px]" />
      </div>
    );
  }

  if (!workbook) return null;

  const hasCells = getWorkbookCellSummary(workbook.cells).length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CardTitle>{t("workbooks.workbook")}</CardTitle>
        <Link href={`/${locale}/platform/workbooks/${workbook.id}`} className="shrink-0">
          <Button variant="buttonLink" className="h-auto p-0">
            {t("workbooks.viewWorkbook")}
          </Button>
        </Link>
      </div>

      <Card className="shadow-none">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <BookOpen className="text-muted-foreground h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{workbook.name}</h3>
              <div className="flex items-center gap-2">
                <p className="text-muted-foreground text-xs">
                  {t("workbooks.lastUpdate")}: {formatDate(workbook.updatedAt)}
                  {workbook.createdByName && <> · {workbook.createdByName}</>}
                </p>
                {pinnedVersion && (
                  <WorkbookVersionBadge
                    currentVersion={pinnedVersion.version}
                    latestVersion={latestVersion?.version}
                    showUpgrade={false}
                  />
                )}
              </div>
            </div>
          </div>

          {workbook.description && (
            <p className="text-muted-foreground mt-3 line-clamp-2 text-sm">
              {workbook.description}
            </p>
          )}

          {hasCells ? (
            <WorkbookCellSummary cells={workbook.cells} className="mt-3" />
          ) : (
            <p className="text-muted-foreground mt-3 text-sm italic">{t("workbooks.noCells")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
