"use client";

import { useLocale } from "@/hooks/useLocale";
import { useWorkbookDelete } from "@/hooks/workbook/useWorkbookDelete/useWorkbookDelete";
import { formatDate } from "@/util/date";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

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
            <ColumnHead>{t("workbooks.columns.name", "Name")}</ColumnHead>
            <ColumnHead>{t("workbooks.columns.user", "User")}</ColumnHead>
            <ColumnHead>{t("workbooks.columns.updated", "Updated")}</ColumnHead>
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { mutate: deleteWorkbook, isPending: isDeleting } = useWorkbookDelete();

  const handleDelete = () => {
    deleteWorkbook(
      { params: { id: workbook.id } },
      {
        onSuccess: () => {
          toast({ title: t("workbooks.messages.deleteSuccess", "Workbook deleted") });
          setConfirmingDelete(false);
        },
      },
    );
  };

  const viewHref = `/${locale}/platform/workbooks/${workbook.id}`;
  const author = workbook.createdByName ?? `${workbook.createdBy.slice(0, 8)}…`;

  return (
    <>
      <TableRow className={cn("group bg-white hover:bg-[#F6F8FA]", TABLE_BORDER)}>
        <TableCell className={cn("px-6 py-3 text-[13px] font-semibold", TEXT_STRONG)}>
          <Link
            href={viewHref}
            className="focus-visible:ring-primary/40 hover:underline focus-visible:outline-none focus-visible:ring-2"
          >
            {workbook.name}
          </Link>
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
        <TableCell className="w-12 px-3 py-3 text-right">
          <div className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("workbooks.actions.edit", "Edit")}
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
                    {t("workbooks.actions.edit", "Edit")}
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
                  {t("workbooks.actions.delete", "Delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workbooks.actions.delete", "Delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workbooks.messages.deleteConfirm", {
                name: workbook.name,
                defaultValue: `Permanently delete “${workbook.name}”? This cannot be undone.`,
              })}
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
                t("workbooks.actions.delete", "Delete")
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
