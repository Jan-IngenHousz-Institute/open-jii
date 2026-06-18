"use client";

import { useMemo } from "react";

import type { ExperimentDashboard } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";

import { DashboardTableRow } from "./dashboard-table-row";
import {
  LIST_HEADER_BG,
  LIST_TABLE_BORDER,
  LIST_TEXT_MUTED,
} from "./experiment-dashboards-list-tokens";

interface ExperimentDashboardsListProps {
  dashboards: ExperimentDashboard[];
  experimentId: string;
  isLoading?: boolean;
  isArchived?: boolean;
}

export default function ExperimentDashboardsList({
  dashboards,
  experimentId,
  isLoading,
  isArchived = false,
}: ExperimentDashboardsListProps) {
  const { t } = useTranslation("experimentDashboards");

  const basePath = isArchived ? "experiments-archive" : "experiments";

  const sorted = useMemo(
    () =>
      [...dashboards].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [dashboards],
  );

  if (!isLoading && sorted.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed p-10 text-center text-sm",
          LIST_TABLE_BORDER,
          LIST_TEXT_MUTED,
        )}
      >
        {t("ui.messages.emptyDashboard")}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border", LIST_TABLE_BORDER)}>
      <Table>
        <TableHeader className={LIST_HEADER_BG}>
          <TableRow className={cn("hover:bg-transparent", LIST_TABLE_BORDER)}>
            <ColumnHead>{t("ui.labels.columns.name")}</ColumnHead>
            <ColumnHead>{t("ui.labels.columns.widgets")}</ColumnHead>
            <ColumnHead>{t("ui.labels.columns.user")}</ColumnHead>
            <ColumnHead>{t("ui.labels.columns.updated")}</ColumnHead>
            <TableHead aria-hidden className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => <SkeletonRow key={index} />)
            : sorted.map((dashboard) => (
                <DashboardTableRow
                  key={dashboard.id}
                  dashboard={dashboard}
                  experimentId={experimentId}
                  basePath={basePath}
                />
              ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ColumnHead({ children }: { children: React.ReactNode }) {
  return (
    <TableHead
      className={cn(
        "h-10 px-6 align-middle text-[11px] font-semibold uppercase tracking-[0.02em]",
        LIST_TEXT_MUTED,
      )}
    >
      {children}
    </TableHead>
  );
}

function SkeletonRow() {
  return (
    <TableRow className={cn("hover:bg-transparent", LIST_TABLE_BORDER)}>
      <TableCell className="px-6 py-3">
        <Skeleton className="h-4 w-48" />
      </TableCell>
      <TableCell className="px-6 py-3">
        <Skeleton className="h-4 w-8" />
      </TableCell>
      <TableCell className="px-6 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
      </TableCell>
      <TableCell className="px-6 py-3">
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell className="w-12 px-6 py-3" />
    </TableRow>
  );
}
