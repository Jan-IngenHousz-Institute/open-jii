"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useDatasetScope } from "@/hooks/dataset/useDatasetScope/useDatasetScope";
import { BookOpenText, FileText, GitBranch, LayoutGrid, Rows3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

import type { PublishDatasetForm } from "./dataset-publish-schema";
import { DatasetPublishStepFrame } from "./dataset-publish-step-frame";

interface ScopeStepProps extends WizardStepProps<PublishDatasetForm> {
  datasetId: string;
}

interface ScopeItem {
  icon: LucideIcon;
  label: string;
  detail: string;
}

export function ScopeStep({ datasetId, ...props }: ScopeStepProps) {
  const { t } = useTranslation("datasets");
  const { data: scope, isLoading } = useDatasetScope(datasetId);

  if (isLoading || scope === undefined) {
    return <Skeleton className="h-72 w-full" />;
  }

  const items: ScopeItem[] = [
    {
      icon: Rows3,
      label: t("scope.readings"),
      detail: t("scope.readingsDetail", { count: scope.readingCount }),
    },
    { icon: BookOpenText, label: t("scope.dictionary"), detail: t("scope.dictionaryDetail") },
    { icon: LayoutGrid, label: t("scope.layout"), detail: t("scope.layoutDetail") },
    { icon: FileText, label: t("scope.studyDetails"), detail: t("scope.studyDetailsDetail") },
  ];

  const renderItem = ({ icon: Icon, label, detail }: ScopeItem) => (
    <li key={label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Icon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-sm">{detail}</p>
      </div>
    </li>
  );

  return (
    <DatasetPublishStepFrame {...props}>
      <SettingsCard title={t("scope.title")} description={t("scope.description")}>
        <ul className="divide-border divide-y">{items.map(renderItem)}</ul>
      </SettingsCard>

      <div className="bg-muted flex items-start gap-3 rounded-lg p-4">
        <GitBranch className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-medium">
            {t("scope.versionTitle", { version: scope.version })}
          </p>
          <p className="text-muted-foreground text-sm">
            {t("scope.versionDetail", { version: scope.version })}
          </p>
        </div>
      </div>
    </DatasetPublishStepFrame>
  );
}
