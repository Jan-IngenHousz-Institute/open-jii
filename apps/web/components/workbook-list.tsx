"use client";

import { WorkbookCellSummary } from "@/components/workbook/workbook-cell-summary";
import { useLocale } from "@/hooks/useLocale";
import { useWorkbookCreate } from "@/hooks/workbook/useWorkbookCreate/useWorkbookCreate";
import { useWorkbookDelete } from "@/hooks/workbook/useWorkbookDelete/useWorkbookDelete";
import { formatDate } from "@/util/date";
import { Copy, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useMemo, useState } from "react";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { Workbook } from "@repo/api/schemas/workbook.schema";
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
  DropdownMenuSeparator,
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

interface WorkbookListProps {
  workbooks: Workbook[] | undefined;
  isLoading?: boolean;
}

const HEADER_BG = "bg-[#F6F8FA]";
const TABLE_BORDER = "border-[#CDD5DB]";
const TEXT_STRONG = "text-[#011111]";
const TEXT_MUTED = "text-[#68737B]";

export function WorkbookList({ workbooks, isLoading }: WorkbookListProps) {
  const { t } = useTranslation("workbook");

  const sorted = useMemo(
    () =>
      [...(workbooks ?? [])].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [workbooks],
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
        {t("workbooks.noWorkbooks")}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border", TABLE_BORDER)}>
      <Table>
        <TableHeader>
          <TableRow className={cn("hover:bg-transparent", HEADER_BG, TABLE_BORDER)}>
            <ColumnHead>{t("workbooks.columns.name")}</ColumnHead>
            <ColumnHead>{t("workbooks.columns.usedBy")}</ColumnHead>
            <ColumnHead>{t("workbooks.columns.user")}</ColumnHead>
            <ColumnHead>{t("workbooks.columns.updated")}</ColumnHead>
            <TableHead aria-hidden className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => <SkeletonRow key={index} />)
            : sorted.map((workbook) => <WorkbookTableRow key={workbook.id} workbook={workbook} />)}
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
        <Skeleton className="h-4 w-20" />
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

function WorkbookTableRow({ workbook }: { workbook: Workbook }) {
  const { t } = useTranslation("workbook");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { mutate: deleteWorkbook, isPending: isDeleting } = useWorkbookDelete();
  const { mutate: createWorkbook, isPending: isDuplicating } = useWorkbookCreate({
    onSuccess: (data) => router.push(`/${locale}/platform/workbooks/${data.body.id}`),
  });

  const handleDelete = () => {
    deleteWorkbook(
      { params: { id: workbook.id } },
      {
        onSuccess: () => {
          toast({ title: t("workbooks.messages.deleteSuccess") });
          setConfirmingDelete(false);
        },
      },
    );
  };

  const handleDuplicate = () => {
    createWorkbook(
      {
        body: {
          name: t("workbooks.duplicateName", { name: workbook.name }),
          description: workbook.description ?? undefined,
          cells: workbook.cells,
          metadata: workbook.metadata,
        },
      },
      {
        onError: () => toast({ title: t("workbooks.createError"), variant: "destructive" }),
      },
    );
  };

  const viewHref = `/${locale}/platform/workbooks/${workbook.id}`;
  const author = workbook.createdByName ?? `${workbook.createdBy.slice(0, 8)}…`;
  const usedBy = workbook.experimentCount ?? 0;

  // Deleting a workbook attached to experiments unlinks them and loses their
  // measurement flow, so that path is gated behind a feature flag (same as
  // experiment deletion). Unused workbooks stay freely deletable.
  const workbookDeletionEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.WORKBOOK_DELETION);
  const canDelete = usedBy === 0 || workbookDeletionEnabled === true;

  return (
    <>
      <TableRow
        className={cn(
          "group cursor-pointer bg-white hover:bg-[#F6F8FA] has-[[data-state=open]]:bg-[#F6F8FA]",
          TABLE_BORDER,
        )}
        onClick={() => router.push(viewHref)}
      >
        <TableCell className="px-6 py-3">
          <Link
            href={viewHref}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "focus-visible:ring-primary/40 focus-visible:outline-hidden text-[13px] font-semibold hover:underline focus-visible:ring-2",
              TEXT_STRONG,
            )}
          >
            {workbook.name}
          </Link>
          <WorkbookCellSummary cells={workbook.cells} className="mt-1.5" />
        </TableCell>
        <TableCell className={cn("px-6 py-3 text-[13px]", TEXT_MUTED)}>
          {usedBy > 0 ? (
            <span className={TEXT_STRONG}>{t("workbooks.usedByCount", { count: usedBy })}</span>
          ) : (
            t("workbooks.notUsed")
          )}
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
          {formatDate(workbook.updatedAt)}
        </TableCell>
        <TableCell className="w-12 px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("workbooks.actions.more")}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-md hover:bg-[#EDF2F6] hover:text-[#011111] data-[state=open]:bg-[#EDF2F6] data-[state=open]:text-[#011111]",
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
                    {t("workbooks.actions.open")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isDuplicating}
                  onSelect={(e) => {
                    e.preventDefault();
                    handleDuplicate();
                  }}
                >
                  <Copy className="mr-2 size-4" />
                  {t("workbooks.actions.duplicate")}
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        setConfirmingDelete(true);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 size-4" />
                      {t("workbooks.actions.delete")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workbooks.actions.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {usedBy > 0
                ? t("workbooks.messages.deleteInUseConfirm", { name: workbook.name, count: usedBy })
                : t("workbooks.messages.deleteConfirm", { name: workbook.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tCommon("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("workbooks.actions.delete")
              )}
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
