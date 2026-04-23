import { useLocale } from "@/hooks/useLocale";
import { BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import React from "react";

import type { Workbook } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { Skeleton } from "@repo/ui/components/skeleton";

interface WorkbookOverviewCardsProps {
  workbooks: Workbook[] | undefined;
  isLoading: boolean;
}

function WorkbookCard({
  workbook,
  locale,
  t,
}: {
  workbook: Workbook;
  locale: string;
  t: (key: string) => string;
}) {
  const cellCount = workbook.cells.length;

  return (
    <Link href={`/${locale}/platform/workbooks/${workbook.id}`}>
      <div className="relative flex h-full min-h-[180px] flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:scale-[1.02] hover:shadow-lg">
        <div className="inline-flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-gray-400" />
          {cellCount > 0 && (
            <Badge className="bg-badge">
              {cellCount} {cellCount === 1 ? "cell" : "cells"}
            </Badge>
          )}
        </div>
        <div className="mb-auto">
          <h3 className="mb-2 line-clamp-2 break-words text-base font-semibold text-gray-900 md:text-lg">
            {workbook.name}
          </h3>
          <div className="overflow-hidden text-sm text-gray-500">
            <RichTextRenderer
              content={workbook.description ?? t("workbooks.noDescription")}
              truncate
              maxLines={2}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400">
          {t("workbooks.lastUpdate")}: {new Date(workbook.updatedAt).toLocaleDateString()}
        </p>
        <ChevronRight className="absolute bottom-5 right-5 h-6 w-6 text-gray-900 md:hidden" />
      </div>
    </Link>
  );
}

export function WorkbookOverviewCards({ workbooks, isLoading }: WorkbookOverviewCardsProps) {
  const { t } = useTranslation("workbook");
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-48" />
        ))}
      </div>
    );
  }

  if (!workbooks || workbooks.length === 0) {
    return (
      <div className="text-[0.9rem] font-normal leading-[1.3125rem] text-[#68737B]">
        {t("workbooks.noWorkbooks")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {workbooks.map((workbook) => (
        <WorkbookCard key={workbook.id} workbook={workbook} locale={locale} t={t} />
      ))}
    </div>
  );
}
