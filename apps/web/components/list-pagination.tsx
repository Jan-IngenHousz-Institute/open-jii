"use client";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface ListPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ListPagination({ page, totalPages, onPageChange }: ListPaginationProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-sm">
        {t("pagination.pageOf", { page, totalPages })}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t("pagination.previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("pagination.next")}
        </Button>
      </div>
    </div>
  );
}
