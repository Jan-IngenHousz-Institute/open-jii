"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { rowSortingFeature, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef, RowData, SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";

import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
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

export interface OverviewTableColumn<T extends RowData> {
  /** Translated header label; null renders an aria-hidden spacer head (actions column). */
  header: ReactNode;
  /** Stable server sort field. Omit for columns that are not sortable. */
  sortId?: string;
  /** Extra classes for both the head and every cell of the column. */
  className?: string;
  /** Row cell content; `href` is the row's navigation target (for name links). */
  cell: (item: T, href: string) => ReactNode;
}

interface OverviewTableProps<T extends RowData> {
  columns: OverviewTableColumn<T>[];
  items: T[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  errorMessage?: string;
  retryLabel?: string;
  getRowKey: (item: T) => string;
  getRowHref: (item: T) => string;
  emptyMessage: string;
  emptyHelpPath?: string;
  sorting?: {
    state: SortingState;
    onToggle: (field: string, multi: boolean) => void;
    labels: { unsorted: string; asc: string; desc: string; secondary: string };
  };
}

const HEADER_BG = "bg-muted/50";
const TABLE_BORDER = "border-border";
const TEXT_STRONG = "text-foreground";
const TEXT_MUTED = "text-muted-foreground";
const EMPTY_ITEMS: never[] = [];

export const overviewTableText = { strong: TEXT_STRONG, muted: TEXT_MUTED };

const overviewTableFeatures = tableFeatures({ rowSortingFeature });

interface OverviewColumnMeta {
  className?: string;
  spacer: boolean;
  label?: string;
}

export function OverviewTable<T extends RowData>({
  columns,
  items,
  isLoading,
  error,
  onRetry,
  errorMessage,
  retryLabel,
  getRowKey,
  getRowHref,
  emptyMessage,
  emptyHelpPath,
  sorting,
}: OverviewTableProps<T>) {
  const router = useRouter();
  const loading = isLoading === true;
  const tableColumns = useMemo<ColumnDef<typeof overviewTableFeatures, T>[]>(
    () =>
      columns.map((column, index) => ({
        id: column.sortId ?? `column-${index}`,
        accessorFn: column.sortId ? () => null : undefined,
        enableSorting: Boolean(sorting && column.sortId),
        header: () => column.header,
        cell: ({ row }) => column.cell(row.original, getRowHref(row.original)),
        meta: {
          className: column.className,
          spacer: column.header == null,
          label: typeof column.header === "string" ? column.header : undefined,
        } satisfies OverviewColumnMeta,
      })),
    [columns, getRowHref],
  );
  const table = useTable({
    features: overviewTableFeatures,
    data: items ?? EMPTY_ITEMS,
    columns: tableColumns,
    getRowId: (item) => getRowKey(item),
    manualSorting: true,
    state: { sorting: sorting?.state ?? [] },
  });

  if (!loading && items === undefined) {
    return (
      <EmptyState
        size="inline"
        variant="error"
        description={errorMessage ?? (error instanceof Error ? error.message : emptyMessage)}
        action={
          onRetry && retryLabel ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (!loading && items?.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed p-10 text-center text-sm",
          TABLE_BORDER,
          TEXT_MUTED,
        )}
      >
        {emptyMessage}
        {emptyHelpPath && (
          <div className="mt-2">
            <DocsHelpLink path={emptyHelpPath} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-md border", TABLE_BORDER)}>
      <Table className="table-fixed">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className={cn("hover:bg-transparent", HEADER_BG, TABLE_BORDER)}
            >
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as OverviewColumnMeta;
                return (
                  <TableHead
                    key={header.id}
                    aria-hidden={meta.spacer ? true : undefined}
                    aria-sort={
                      header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : undefined
                    }
                    className={cn(
                      "h-10 px-6 align-middle text-[11px] font-semibold uppercase tracking-[0.02em]",
                      header.column.getIsSorted() ? TEXT_STRONG : TEXT_MUTED,
                      meta.className,
                    )}
                  >
                    {header.isPlaceholder ? null : sorting && header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="hover:text-foreground inline-flex items-center gap-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                        aria-label={`${meta.label ?? header.column.id}: ${sorting.labels[header.column.getIsSorted() || "unsorted"]}${header.column.getSortIndex() > 0 ? `, ${sorting.labels.secondary}` : ""}`}
                        onClick={(event) => sorting.onToggle(header.column.id, event.shiftKey)}
                      >
                        <table.FlexRender header={header} />
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp aria-hidden className="text-status-active-foreground size-3.5" />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown
                            aria-hidden
                            className="text-status-active-foreground size-3.5"
                          />
                        ) : (
                          <ArrowUpDown aria-hidden className="size-3.5 opacity-50" />
                        )}
                        {header.column.getSortIndex() > 0 ? <span aria-hidden>2</span> : null}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 4 }).map((_, rowIndex) => (
                <TableRow key={rowIndex} className={cn("hover:bg-transparent", TABLE_BORDER)}>
                  {columns.map((column, columnIndex) => (
                    <TableCell
                      key={columnIndex}
                      className={cn("min-w-0 overflow-hidden px-6 py-3", column.className)}
                    >
                      <Skeleton className={cn("h-4", columnIndex === 0 ? "w-48" : "w-24")} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : table.getRowModel().rows.map((row) => {
                const href = getRowHref(row.original);
                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "hover:bg-muted has-[[data-state=open]]:bg-muted group cursor-pointer",
                      TABLE_BORDER,
                    )}
                    onClick={() => router.push(href)}
                  >
                    {row.getAllCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as OverviewColumnMeta;
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn("min-w-0 overflow-hidden px-6 py-3", meta.className)}
                        >
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
    </div>
  );
}
