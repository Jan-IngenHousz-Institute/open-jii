"use client";

import { useExperimentVisualizationDelete } from "@/hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete";
import { formatDate } from "@/util/date";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  ChartFamily,
  ChartType,
  ExperimentVisualization,
} from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { toast } from "@repo/ui/hooks/use-toast";
import { cn } from "@repo/ui/lib/utils";

import { getChartTypeDef } from "./charts/registry";

interface ExperimentVisualizationsListProps {
  visualizations: ExperimentVisualization[];
  experimentId: string;
  isLoading?: boolean;
  isArchived?: boolean;
}

// Inline color tokens to match the shared Figma table spec (see also the
// dashboards list). Promote to design tokens once a third surface lands.
const HEADER_BG = "bg-[#F6F8FA]";
const TABLE_BORDER = "border-[#CDD5DB]";
const TEXT_STRONG = "text-[#011111]";
const TEXT_MUTED = "text-[#68737B]";

// Type-pill background is keyed off chart family so the list scales to all
// 20+ chart types without per-type bookkeeping. Unsupported types fall
// through to the neutral token.
const FAMILY_BADGE_CLASS: Record<ChartFamily, string> = {
  basic: "bg-badge-published",
  statistical: "bg-badge-stale",
  scientific: "bg-badge-archived",
  "3d": "bg-badge-archived",
};

function getChartTypeBadgeClass(chartType: ChartType): string {
  const family = getChartTypeDef(chartType)?.family;
  return family ? FAMILY_BADGE_CLASS[family] : "bg-badge-archived";
}

/**
 * Tabular visualizations list. Mirrors the dashboards list (and the Figma
 * Protocols spec): bordered container, tinted header band, uppercase
 * column labels, semibold row title, type pill, avatar in the user column.
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

  if (!isLoading && sorted.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed p-10 text-center text-sm",
          TABLE_BORDER,
          TEXT_MUTED,
        )}
      >
        {t("ui.messages.noVisualizations")}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border", TABLE_BORDER)}>
      <Table>
        <TableHeader className={HEADER_BG}>
          <TableRow className={cn("hover:bg-transparent", TABLE_BORDER)}>
            <ColumnHead>{t("ui.labels.columns.name", "Name")}</ColumnHead>
            <ColumnHead>{t("ui.labels.columns.type", "Type")}</ColumnHead>
            <ColumnHead>{t("ui.labels.columns.user", "User")}</ColumnHead>
            <ColumnHead>{t("ui.labels.columns.updated", "Updated")}</ColumnHead>
            <TableHead aria-hidden className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => <SkeletonRow key={index} />)
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
    <TableHead
      className={cn(
        "h-10 px-6 align-middle text-[11px] font-semibold uppercase tracking-[0.02em]",
        TEXT_MUTED,
      )}
    >
      {children}
    </TableHead>
  );
}

function SkeletonRow() {
  return (
    <TableRow className={cn("hover:bg-transparent", TABLE_BORDER)}>
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

interface VisualizationTableRowProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  basePath: string;
}

function VisualizationTableRow({
  visualization,
  experimentId,
  basePath,
}: VisualizationTableRowProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { mutate: deleteVisualization, isPending: isDeleting } = useExperimentVisualizationDelete({
    experimentId,
    onSuccess: () => {
      toast({ title: t("ui.messages.deleteSuccess") });
      setConfirmingDelete(false);
    },
  });

  const viewHref = `/platform/${basePath}/${experimentId}/analysis/visualizations/${visualization.id}`;
  const author = visualization.createdByName ?? `${visualization.createdBy.slice(0, 8)}…`;
  const def = getChartTypeDef(visualization.chartType);
  const typeLabel = def ? t(def.labelKey) : visualization.chartType;
  const typeBadgeClass = getChartTypeBadgeClass(visualization.chartType);

  return (
    <>
      <TableRow className={cn("group bg-white hover:bg-[#F6F8FA]", TABLE_BORDER)}>
        <TableCell className={cn("px-6 py-3 text-[13px] font-semibold", TEXT_STRONG)}>
          <Link
            href={viewHref}
            className="focus-visible:ring-primary/40 hover:underline focus-visible:outline-none focus-visible:ring-2"
          >
            {visualization.name}
          </Link>
        </TableCell>
        <TableCell className="px-6 py-3">
          <span
            className={cn(
              "text-muted-dark inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
              typeBadgeClass,
            )}
          >
            {typeLabel}
          </span>
        </TableCell>
        <TableCell className="px-6 py-3">
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className={cn("text-[10px] font-medium", TEXT_MUTED)}>
                {initialsOf(author)}
              </AvatarFallback>
            </Avatar>
            <span className={cn("text-[13px]", TEXT_MUTED)}>{author}</span>
          </div>
        </TableCell>
        <TableCell className={cn("px-6 py-3 text-[13px] tabular-nums", TEXT_MUTED)}>
          {formatDate(visualization.updatedAt)}
        </TableCell>
        <TableCell className="w-12 px-3 py-3 text-right">
          <div className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("ui.actions.edit")}
                  className={cn(
                    "hover:bg-accent data-[state=open]:bg-accent inline-flex size-8 items-center justify-center rounded-md hover:text-[#011111] data-[state=open]:text-[#011111]",
                    TEXT_MUTED,
                  )}
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={viewHref}>
                    <Pencil className="mr-2 size-4" />
                    {t("ui.actions.edit")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setConfirmingDelete(true);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  {t("ui.actions.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ui.actions.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("ui.messages.deleteConfirm", {
                name: visualization.name,
                defaultValue: `Permanently delete “${visualization.name}”? Dashboards that embed this chart will show a "missing visualization" placeholder.`,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tCommon("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                deleteVisualization({
                  params: { id: experimentId, visualizationId: visualization.id },
                });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : t("ui.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}
