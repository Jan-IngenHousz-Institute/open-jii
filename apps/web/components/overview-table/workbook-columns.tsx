"use client";

import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { WorkbookCellSummary } from "@/components/workbook/workbook-cell-summary";
import { useLocale } from "@/hooks/useLocale";
import { useWorkbookCreate } from "@/hooks/workbook/useWorkbookCreate/useWorkbookCreate";
import { orpc } from "@/lib/orpc";
import { formatShortDate } from "@/util/date";
import { useQueryClient } from "@tanstack/react-query";
import { GitFork, MoreHorizontal, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { WorkbookListItem } from "@repo/api/domains/workbook/workbook.schema";
import { useTranslation } from "@repo/i18n";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { toast } from "@repo/ui/hooks/use-toast";
import { cn } from "@repo/ui/lib/utils";

import type { OverviewTableColumn } from "./overview-table";
import { overviewTableText } from "./overview-table";

function WorkbookActionsCell({ workbook, href }: { workbook: WorkbookListItem; href: string }) {
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

  return (
    <div
      className="flex justify-end opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("workbooks.actions.more")}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md hover:bg-[#EDF2F6] hover:text-[#011111] data-[state=open]:bg-[#EDF2F6] data-[state=open]:text-[#011111]",
              overviewTableText.muted,
            )}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={href}>
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

export function getWorkbookColumns(
  t: (key: string, options?: Record<string, unknown>) => string,
  locale: string,
): OverviewTableColumn<WorkbookListItem>[] {
  return [
    {
      header: t("workbooks.columns.name"),
      cell: (workbook, href) => (
        <>
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "focus-visible:ring-primary/40 focus-visible:outline-hidden text-[13px] font-semibold hover:underline focus-visible:ring-2",
              overviewTableText.strong,
            )}
          >
            {workbook.name}
          </Link>
          {/* Only when private: "public" is the unremarkable default. */}
          <VisibilityBadge visibility={workbook.visibility} privateOnly className="ml-2" />
          <WorkbookCellSummary counts={workbook.cellTypeCounts ?? {}} className="mt-1.5" />
        </>
      ),
    },
    {
      header: t("workbooks.columns.usedBy"),
      className: "w-36",
      cell: (workbook) => {
        const usedBy = workbook.experimentCount ?? 0;
        return usedBy > 0 ? (
          <span className={cn("text-[13px]", overviewTableText.strong)}>
            {t("workbooks.usedByCount", { count: usedBy })}
          </span>
        ) : (
          <span className={cn("text-[13px]", overviewTableText.muted)}>
            {t("workbooks.notUsed")}
          </span>
        );
      },
    },
    {
      header: t("workbooks.columns.user"),
      className: "w-48",
      cell: (workbook) => {
        const author = workbook.createdByName ?? `${workbook.createdBy.slice(0, 8)}…`;
        return (
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className={cn("text-[10px] font-medium", overviewTableText.muted)}>
                {initialsOf(author)}
              </AvatarFallback>
            </Avatar>
            <span className={cn("text-[13px]", overviewTableText.muted)}>{author}</span>
          </div>
        );
      },
    },
    {
      header: t("workbooks.columns.updated"),
      className: "w-40",
      cell: (workbook) => (
        <span className={cn("text-[13px] tabular-nums", overviewTableText.muted)}>
          {formatShortDate(workbook.updatedAt, locale)}
        </span>
      ),
    },
    {
      header: null,
      className: "w-12",
      cell: (workbook, href) => <WorkbookActionsCell workbook={workbook} href={href} />,
    },
  ];
}
