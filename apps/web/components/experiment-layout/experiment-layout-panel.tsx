"use client";

import { useExperimentLayout } from "@/hooks/experiment/useExperimentLayout/useExperimentLayout";

import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { LayoutGrid } from "./layout-grid";
import { LayoutSetupCard } from "./layout-setup-card";

interface ExperimentLayoutPanelProps {
  experimentId: string;
  canEdit: boolean;
}

export function ExperimentLayoutPanel({ experimentId, canEdit }: ExperimentLayoutPanelProps) {
  const { t } = useTranslation("experiments");
  const { data: layout, isLoading } = useExperimentLayout(experimentId);

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!layout) {
    return <EmptyState title={t("layout.empty")} description={t("layout.emptyDescription")} />;
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
      {canEdit ? <LayoutSetupCard layout={layout} /> : null}
      <LayoutGrid layout={layout} />
    </div>
  );
}
