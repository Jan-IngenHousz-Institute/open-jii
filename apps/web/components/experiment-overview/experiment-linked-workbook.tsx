"use client";

import { WorkbookVersionBadge } from "@/components/workbook/workbook-version-badge";
import { useLocale } from "@/hooks/useLocale";
import { useWorkbook } from "@/hooks/workbook/useWorkbook/useWorkbook";
import { useWorkbookVersions } from "@/hooks/workbook/useWorkbookVersions/useWorkbookVersions";
import { formatDate } from "@/util/date";
import { BookOpen, Code, FlaskConical, GitBranch, HelpCircle, FileText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardTitle } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

interface ExperimentLinkedWorkbookProps {
  workbookId: string | null;
  workbookVersionId?: string | null;
}

const cellMeta: Record<string, { label: string; color: string; icon: ReactNode }> = {
  protocol: { label: "Protocol", color: "#2D3142", icon: <FlaskConical className="h-3 w-3" /> },
  macro: { label: "Macro", color: "#6C5CE7", icon: <Code className="h-3 w-3" /> },
  question: { label: "Question", color: "#C58AAE", icon: <HelpCircle className="h-3 w-3" /> },
  branch: { label: "Branch", color: "#D08A3C", icon: <GitBranch className="h-3 w-3" /> },
  markdown: { label: "Note", color: "#6F8596", icon: <FileText className="h-3 w-3" /> },
};

function getCellSummary(cells: WorkbookCell[]) {
  const counts: Record<string, number> = {};
  for (const cell of cells) {
    if (cell.type === "output") continue;
    counts[cell.type] = (counts[cell.type] ?? 0) + 1;
  }
  return Object.entries(counts);
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
  const versionsList = versionsData?.body;
  const pinnedVersion = versionsList?.find((v) => v.id === workbookVersionId);
  const latestVersion = versionsList?.[0];

  if (!workbookId) return null;

  const cellSummary = workbook ? getCellSummary(workbook.cells) : [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CardTitle>{t("workbooks.workbook")}</CardTitle>
        <Skeleton className="h-[120px]" />
      </div>
    );
  }

  if (!workbook) return null;

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

          {cellSummary.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {cellSummary.map(([type, count]) => {
                const meta = cellMeta[type];
                return (
                  <span
                    key={type}
                    className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  >
                    {meta.icon}
                    {count} {meta.label}
                    {count > 1 ? "s" : ""}
                  </span>
                );
              })}
            </div>
          )}

          {cellSummary.length === 0 && (
            <p className="text-muted-foreground mt-3 text-sm italic">{t("workbooks.noCells")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
