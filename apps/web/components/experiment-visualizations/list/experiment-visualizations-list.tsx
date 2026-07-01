"use client";

import { useMemo } from "react";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
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

import { VisualizationTableRow } from "./visualization-table-row";

interface ExperimentVisualizationsListProps {
  visualizations: ExperimentVisualization[];
  experimentId: string;
  isLoading?: boolean;
  isArchived?: boolean;
}

const SKELETON_ROW_COUNT = 4;

/**
 * Tabular visualizations list. Mirrors the dashboards list: bordered container,
 * tinted header band, uppercase column labels, semibold row title, type pill,
 * avatar in the user column.
 */
export default function ExperimentVisualizationsList({
  visualizations,
  experimentId,
  isLoading,
  isArchived = false,
}: ExperimentVisualizationsListProps) {
  const { t } = useTranslation("experimentVisualizations");
  const basePath = isArchived ? "experiments-archive" : "experiments";

  const sorted = useMemo(
    () =>
      [...visualizations].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [visualizations],
  );

  const isEmpty = !isLoading && sorted.length === 0;
  if (isEmpty) {
    return (
      <div className="rounded-lg border border-dashed border-[#CDD5DB] p-10 text-center text-sm text-[#68737B]">
        {t("ui.messages.noVisualizations")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#CDD5DB]">
      <Table>
        <TableHeader className="bg-[#F6F8FA]">
          <TableRow className="border-[#CDD5DB] hover:bg-transparent">
            <ColumnHead>{t("ui.labels.columns.name")}</ColumnHead>
            <ColumnHead>{t("ui.labels.columns.type")}</ColumnHead>
            <ColumnHead>{t("ui.labels.columns.user")}</ColumnHead>
            <ColumnHead>{t("ui.labels.columns.updated")}</ColumnHead>
            <TableHead aria-hidden className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
                <SkeletonRow key={index} />
              ))
            : sorted.map((visualization) => (
                <VisualizationTableRow
                  key={visualization.id}
                  visualization={visualization}
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
    <TableHead className="h-10 px-6 align-middle text-[11px] font-semibold uppercase tracking-[0.02em] text-[#68737B]">
      {children}
    </TableHead>
  );
}

function SkeletonRow() {
  return (
    <TableRow className="border-[#CDD5DB] hover:bg-transparent">
      <TableCell className="px-6 py-3">
        <Skeleton className="h-4 w-48" />
      </TableCell>
      <TableCell className="px-6 py-3">
        <Skeleton className="h-5 w-16 rounded-full" />
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
