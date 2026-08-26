"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { useRouter } from "next/navigation";
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

export interface OverviewTableColumn<T> {
  /** Translated header label; null renders an aria-hidden spacer head (actions column). */
  header: ReactNode;
  /** Extra classes for both the head and every cell of the column. */
  className?: string;
  /** Row cell content; `href` is the row's navigation target (for name links). */
  cell: (item: T, href: string) => ReactNode;
}

interface OverviewTableProps<T> {
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
}

const HEADER_BG = "bg-[#F6F8FA]";
const TABLE_BORDER = "border-[#CDD5DB]";
const TEXT_STRONG = "text-[#011111]";
const TEXT_MUTED = "text-[#68737B]";

export const overviewTableText = { strong: TEXT_STRONG, muted: TEXT_MUTED };

export function OverviewTable<T>({
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
}: OverviewTableProps<T>) {
  const router = useRouter();
  const loading = isLoading === true;

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
    <div className={cn("overflow-hidden rounded-lg border", TABLE_BORDER)}>
      <Table>
        <TableHeader>
          <TableRow className={cn("hover:bg-transparent", HEADER_BG, TABLE_BORDER)}>
            {columns.map((column, index) => (
              <TableHead
                key={index}
                aria-hidden={column.header == null || undefined}
                className={cn(
                  "h-10 px-6 align-middle text-[11px] font-semibold uppercase tracking-[0.02em]",
                  TEXT_MUTED,
                  column.className,
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 4 }).map((_, rowIndex) => (
                <TableRow key={rowIndex} className={cn("hover:bg-transparent", TABLE_BORDER)}>
                  {columns.map((column, columnIndex) => (
                    <TableCell key={columnIndex} className={cn("px-6 py-3", column.className)}>
                      <Skeleton className={cn("h-4", columnIndex === 0 ? "w-48" : "w-24")} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : (items ?? []).map((item) => {
                const href = getRowHref(item);
                return (
                  <TableRow
                    key={getRowKey(item)}
                    className={cn(
                      "group cursor-pointer bg-white hover:bg-[#F6F8FA] has-[[data-state=open]]:bg-[#F6F8FA]",
                      TABLE_BORDER,
                    )}
                    onClick={() => router.push(href)}
                  >
                    {columns.map((column, columnIndex) => (
                      <TableCell key={columnIndex} className={cn("px-6 py-3", column.className)}>
                        {column.cell(item, href)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
    </div>
  );
}
