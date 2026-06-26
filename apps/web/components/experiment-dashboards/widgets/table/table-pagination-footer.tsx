"use client";

import { useTranslation } from "@repo/i18n";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/pagination";
import { Skeleton } from "@repo/ui/components/skeleton";

interface TablePaginationFooterProps {
  page: number;
  totalPages: number;
  onPageChange: (next: number) => void;
  isLoading: boolean;
}

const DISABLED_CLASS = "pointer-events-none opacity-50";

export function TablePaginationFooter({
  page,
  totalPages,
  onPageChange,
  isLoading,
}: TablePaginationFooterProps) {
  const { t } = useTranslation("experimentDashboards");

  if (isLoading) {
    return <SkeletonFooter />;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const goPrev = () => onPageChange(Math.max(1, page - 1));
  const goNext = () => onPageChange(Math.min(totalPages, page + 1));

  return (
    <div className="bg-card flex shrink-0 items-center justify-between border-t px-2 py-1">
      <span className="text-muted-foreground whitespace-nowrap text-xs">
        {t("widget.tablePageOf", { page, totalPages })}
      </span>
      <Pagination className="m-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              size="sm"
              onClick={goPrev}
              aria-disabled={!hasPrev}
              className={hasPrev ? "" : DISABLED_CLASS}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              size="sm"
              onClick={goNext}
              aria-disabled={!hasNext}
              className={hasNext ? "" : DISABLED_CLASS}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

function SkeletonFooter() {
  return (
    <div className="bg-card flex shrink-0 items-center justify-between border-t px-2 py-1">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-32" />
    </div>
  );
}
