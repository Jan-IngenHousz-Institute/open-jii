"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { WorkbookCellSummary } from "@/components/workbook/workbook-cell-summary";
import { useLocale } from "@/hooks/useLocale";
import { useWorkbookCreate } from "@/hooks/workbook/useWorkbookCreate/useWorkbookCreate";
import { orpc } from "@/lib/orpc";
import { formatDate } from "@/util/date";
import { useQueryClient } from "@tanstack/react-query";
import { GitFork, MoreHorizontal, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import type { WorkbookListItem } from "@repo/api/domains/workbook/workbook.schema";
import { useTranslation } from "@repo/i18n";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
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
  workbooks: WorkbookListItem[] | undefined;
  isLoading?: boolean;
  showEmptyHelp?: boolean;
}

const HEADER_BG = "bg-muted";
const TABLE_BORDER = "border-border";
const TEXT_STRONG = "text-foreground";
const TEXT_MUTED = "text-muted-foreground";

export function WorkbookList({ workbooks, isLoading, showEmptyHelp = false }: WorkbookListProps) {
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
        {showEmptyHelp && (
          <div className="mt-2">
            <DocsHelpLink path="/guide/experiments/workbooks" />
          </div>
        )}
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

function WorkbookTableRow({ workbook }: { workbook: WorkbookListItem }) {
  const { t } = useTranslation("workbook");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { mutate: createWorkbook, isPending: isDuplicating } = useWorkbookCreate({
    onSuccess: (data) => router.push(`/${locale}/platform/workbooks/${data.id}`),
  });

  // List rows don't carry cells, so duplication first fetches the full workbook.
  const handleDuplicate = async () => {
    let cells;
    try {
      ({ cells } = await queryClient.fetchQuery(
        orpc.workbooks.getWorkbook.queryOptions({ input: { id: workbook.id } }),
      ));
    } catch {
      toast({ title: t("workbooks.createError"), variant: "destructive" });
      return;
    }
    createWorkbook(
      {
        name: t("workbooks.duplicateName", { name: workbook.name }),
        description: workbook.description ?? undefined,
        cells,
        metadata: workbook.metadata,
        forkedFrom: workbook.id,
      },
      {
        onError: () => toast({ title: t("workbooks.createError"), variant: "destructive" }),
      },
    );
  };

  const viewHref = `/${locale}/platform/workbooks/${workbook.id}`;
  const author = workbook.createdByName ?? `${workbook.createdBy.slice(0, 8)}…`;
  const usedBy = workbook.experimentCount ?? 0;

  return (
    <>
      <TableRow
        className={cn(
          "bg-card hover:bg-muted has-[[data-state=open]]:bg-muted group cursor-pointer",
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
          {/* Only when private: "public" is the unremarkable default. */}
          <VisibilityBadge visibility={workbook.visibility} privateOnly className="ml-2" />
          <WorkbookCellSummary counts={workbook.cellTypeCounts ?? {}} className="mt-1.5" />
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("workbooks.actions.more")}
                  className={cn("data-[state=open]:bg-accent size-8", TEXT_MUTED)}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
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
                    void handleDuplicate();
                  }}
                >
                  <GitFork className="mr-2 size-4" />
                  {t("workbooks.actions.fork")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
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
