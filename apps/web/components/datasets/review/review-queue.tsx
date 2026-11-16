"use client";

import { OverviewTable } from "@/components/overview-table/overview-table";
import { useReviewQueue } from "@/hooks/dataset/useReviewQueue/useReviewQueue";
import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";

import type { ReviewQueueItem } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

import { getReviewQueueColumns } from "./review-queue-columns";

/** Every frozen dataset waiting for a data steward, the longest waiting first. */
export function ReviewQueue() {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);
  const { data: items, isLoading, error, refetch } = useReviewQueue();

  const getRowHref = (item: ReviewQueueItem) => `/${locale}/platform/datasets/review/${item.id}`;
  const getRowKey = (item: ReviewQueueItem) => item.id;

  const handleRetry = () => {
    void refetch();
  };

  return (
    <div data-testid="review-queue">
      <OverviewTable
        columns={getReviewQueueColumns({
          t,
          formatDate: format.date,
          formatRelative: format.relative,
        })}
        items={items}
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
        errorMessage={t("review.loadError")}
        retryLabel={t("review.retry")}
        getRowKey={getRowKey}
        getRowHref={getRowHref}
        emptyMessage={t("review.empty")}
      />
    </div>
  );
}
