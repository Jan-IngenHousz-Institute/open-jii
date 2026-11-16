"use client";

import { useDatasetReview } from "@/hooks/dataset/useDatasetReview/useDatasetReview";
import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { DatasetArticle } from "../page/dataset-article";
import { ReviewChecklistCard } from "./review-checklist-card";

/** A frozen dataset's page as it will be public, beside the steward's checklist. */
export function DatasetReviewView({ datasetId }: { datasetId: string }) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);
  const { data: review, isLoading, error, refetch } = useDatasetReview(datasetId);

  const handleRetry = () => {
    void refetch();
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (error !== null || review === undefined) {
    return (
      <EmptyState
        variant="error"
        description={t("review.loadError")}
        action={
          <Button variant="outline" size="sm" onClick={handleRetry}>
            {t("review.retry")}
          </Button>
        }
      />
    );
  }

  const { dataset } = review;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{t("review.pageTitle")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("review.frozenBy", {
            experiment: review.experimentName,
            name: review.frozenByName,
            date: format.date(review.frozenAt),
          })}
        </p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="bg-card rounded-xl border p-8" data-testid="review-preview">
          <DatasetArticle dataset={dataset} />
        </div>
        <div className="lg:sticky lg:top-6">
          <ReviewChecklistCard
            datasetId={dataset.id}
            version={dataset.version}
            checklist={review.checklist}
          />
        </div>
      </div>
    </div>
  );
}
