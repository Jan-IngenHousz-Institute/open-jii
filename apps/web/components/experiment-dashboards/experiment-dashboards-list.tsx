"use client";

import { useExperimentDashboardDelete } from "@/hooks/experiment/useExperimentDashboardDelete/useExperimentDashboardDelete";
import { formatDate } from "@/util/date";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { ExperimentDashboard } from "@repo/api/schemas/experiment.schema";
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

interface ExperimentDashboardsListProps {
  dashboards: ExperimentDashboard[];
  experimentId: string;
  isLoading?: boolean;
  isArchived?: boolean;
}

// Inline color tokens to match the Figma spec exactly. These don't have
// equivalents in the existing Tailwind palette and aren't reused elsewhere
// yet — promote to design tokens once a second surface needs them.
const HEADER_BG = "bg-[#F6F8FA]";
const TABLE_BORDER = "border-[#CDD5DB]";
const TEXT_STRONG = "text-[#011111]";
const TEXT_MUTED = "text-[#68737B]";

/**
 * Tabular dashboard list. Mirrors the Protocols table design: bordered
 * container with a tinted header band, uppercase column labels, semibold
 * row titles, avatar in the researcher column. Sorted by `updatedAt` desc
 * (no client-side sort yet — all rows render server-side and the column
 * headers are visually static).
 */
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
          TABLE_BORDER,
          TEXT_MUTED,
        )}
      >
        {t("ui.messages.noDashboards")}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border", TABLE_BORDER)}>
      <Table>
        <TableHeader className={HEADER_BG}>
          <TableRow className={cn("hover:bg-transparent", TABLE_BORDER)}>
            <ColumnHead>{t("ui.labels.columns.name", "Name")}</ColumnHead>
            <ColumnHead>{t("ui.labels.columns.widgets", "Widgets")}</ColumnHead>
            <ColumnHead>{t("ui.labels.columns.user", "User")}</ColumnHead>
            <ColumnHead>{t("ui.labels.columns.updated", "Updated")}</ColumnHead>
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

interface DashboardTableRowProps {
  dashboard: ExperimentDashboard;
  experimentId: string;
  basePath: string;
}

function DashboardTableRow({ dashboard, experimentId, basePath }: DashboardTableRowProps) {
  const { t } = useTranslation("experimentDashboards");
  const { t: tCommon } = useTranslation("common");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { mutate: deleteDashboard, isPending: isDeleting } = useExperimentDashboardDelete({
    experimentId,
    onSuccess: () => {
      toast({ title: t("ui.messages.deleteSuccess") });
      setConfirmingDelete(false);
    },
  });

  const viewHref = `/platform/${basePath}/${experimentId}/dashboards/${dashboard.id}`;
  const editHref = `/platform/${basePath}/${experimentId}/dashboards/${dashboard.id}/edit`;
  const widgetCount = dashboard.widgets.length;
  const author = dashboard.createdByName ?? `${dashboard.createdBy.slice(0, 8)}…`;

  return (
    <>
      <TableRow className={cn("group bg-white hover:bg-[#F6F8FA]", TABLE_BORDER)}>
        <TableCell className={cn("px-6 py-3 text-[13px] font-semibold", TEXT_STRONG)}>
          <Link
            href={viewHref}
            className="focus-visible:ring-primary/40 hover:underline focus-visible:outline-none focus-visible:ring-2"
          >
            {dashboard.name}
          </Link>
        </TableCell>
        <TableCell className={cn("px-6 py-3 text-[13px]", TEXT_MUTED)}>{widgetCount}</TableCell>
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
          {formatDate(dashboard.updatedAt)}
        </TableCell>
        <TableCell className="w-12 px-3 py-3 text-right">
          <div className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
                  <Link href={editHref}>
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
                name: dashboard.name,
                defaultValue: `Permanently delete “${dashboard.name}”? Visualizations referenced by this dashboard are not affected.`,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {tCommon("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                deleteDashboard({
                  params: { id: experimentId, dashboardId: dashboard.id },
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
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
