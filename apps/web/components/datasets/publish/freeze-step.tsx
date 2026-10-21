"use client";

import { useDatasetScope } from "@/hooks/dataset/useDatasetScope/useDatasetScope";
import { Snowflake } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

import type { PublishDatasetForm } from "./dataset-publish-schema";
import { FreezeCommitsCard } from "./freeze-commits-card";
import { FreezeConfirmDialog } from "./freeze-confirm-dialog";
import { FreezeSummaryCard } from "./freeze-summary-card";
import { StepLoadError } from "./step-load-error";

interface FreezeStepProps extends WizardStepProps<PublishDatasetForm> {
  datasetId: string;
  version: number;
  onFreeze: (data: PublishDatasetForm) => void;
}

/** The last step: what becomes public, then a confirmation before anything is written. */
export function FreezeStep({
  datasetId,
  version,
  onFreeze,
  form,
  onPrevious,
  isSubmitting = false,
}: FreezeStepProps) {
  const { t } = useTranslation("datasets");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { data: scope, isLoading, isError, refetch } = useDatasetScope(datasetId);

  const handleRetry = () => {
    void refetch();
  };
  const openConfirm = () => setIsConfirmOpen(true);
  const handleConfirm = () => {
    void form.handleSubmit(onFreeze)();
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      {isError || scope === undefined ? (
        <StepLoadError
          message={t("publish.loadError")}
          retryLabel={t("publish.retry")}
          onRetry={handleRetry}
        />
      ) : (
        <>
          <FreezeSummaryCard values={form.getValues()} scope={scope} />
          <FreezeCommitsCard />
        </>
      )}

      <div className="mt-6 flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={onPrevious} disabled={isSubmitting}>
          {t("publish.back")}
        </Button>
        <Button type="button" onClick={openConfirm} disabled={isSubmitting || scope === undefined}>
          <Snowflake className="size-4" aria-hidden />
          {t("freeze.submit", { version })}
        </Button>
      </div>

      <FreezeConfirmDialog
        version={version}
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={handleConfirm}
        isPending={isSubmitting}
      />
    </div>
  );
}
