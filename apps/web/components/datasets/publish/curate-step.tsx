"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useDatasetFlaggedReadings } from "@/hooks/dataset/useDatasetFlaggedReadings/useDatasetFlaggedReadings";

import type { FlaggedReading } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

import type { PublishDatasetForm } from "./dataset-publish-schema";
import { DatasetPublishStepFrame } from "./dataset-publish-step-frame";
import { FlaggedReadingRow } from "./flagged-reading-row";

interface CurateStepProps extends WizardStepProps<PublishDatasetForm> {
  datasetId: string;
}

export function CurateStep({ datasetId, ...props }: CurateStepProps) {
  const { t } = useTranslation("datasets");
  const { t: tCommon } = useTranslation();
  const { form } = props;
  const { data: readings, isLoading } = useDatasetFlaggedReadings(datasetId);
  const excluded = form.watch("excludedReadings");

  if (isLoading || readings === undefined) {
    return <Skeleton className="h-72 w-full" />;
  }

  const excludedIds = new Set(excluded.map((reading) => reading.rowId));

  // The flag's comment travels with the exclusion as its reason, so editing the flag later
  // leaves the dataset's record alone.
  const handleExcludedChange = (reading: FlaggedReading, isExcluded: boolean) => {
    const others = excluded.filter((entry) => entry.rowId !== reading.rowId);
    const reason =
      reading.comment ?? tCommon(`experimentDataAnnotations.flagTypes.${reading.flagType}`);
    const next = isExcluded ? [...others, { rowId: reading.rowId, reason }] : others;
    form.setValue("excludedReadings", next, { shouldDirty: true });
  };

  const renderRow = (reading: FlaggedReading) => (
    <FlaggedReadingRow
      key={reading.rowId}
      reading={reading}
      isExcluded={excludedIds.has(reading.rowId)}
      onExcludedChange={handleExcludedChange}
    />
  );

  return (
    <DatasetPublishStepFrame {...props}>
      <SettingsCard title={t("curate.title")} description={t("curate.description")}>
        {readings.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("curate.none")}</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border" data-testid="flagged-readings">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">{t("curate.columns.plot")}</TableHead>
                    <TableHead>{t("curate.columns.flag")}</TableHead>
                    <TableHead>{t("curate.columns.comment")}</TableHead>
                    <TableHead>{t("curate.columns.flaggedBy")}</TableHead>
                    <TableHead className="pr-4 text-right">{t("curate.columns.exclude")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{readings.map(renderRow)}</TableBody>
              </Table>
            </div>
            <p className="text-muted-foreground text-sm">
              {t("curate.excludedCount", { count: excludedIds.size })}
            </p>
          </div>
        )}
      </SettingsCard>
    </DatasetPublishStepFrame>
  );
}
