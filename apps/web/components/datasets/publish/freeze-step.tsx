"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useDatasetScope } from "@/hooks/dataset/useDatasetScope/useDatasetScope";
import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";
import { Info } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

import type { PublishDatasetForm } from "./dataset-publish-schema";
import { DatasetPublishStepFrame } from "./dataset-publish-step-frame";

interface FreezeStepProps extends WizardStepProps<PublishDatasetForm> {
  datasetId: string;
}

export function FreezeStep({ datasetId, ...props }: FreezeStepProps) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);
  const { data: scope, isLoading } = useDatasetScope(datasetId);

  if (isLoading || scope === undefined) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <DatasetPublishStepFrame {...props}>
      <SettingsCard title={t("freeze.title")} contentClassName="space-y-4">
        <p className="text-sm">
          {t("freeze.readings", {
            count: scope.readingCount,
            time: format.dateTime(scope.countedAt),
          })}
        </p>
        <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md p-2 text-sm">
          <Info className="text-primary size-4 shrink-0" aria-hidden />
          <span className="leading-tight">{t("freeze.neverChanges")}</span>
        </div>
      </SettingsCard>
    </DatasetPublishStepFrame>
  );
}
