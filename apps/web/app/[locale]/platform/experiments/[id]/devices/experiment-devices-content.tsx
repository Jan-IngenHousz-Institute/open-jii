"use client";

import { ExperimentDevicesPanel } from "@/components/experiment-settings/devices/experiment-devices-panel";
import { PageContainer } from "@/components/page-container";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { use } from "react";

import { useTranslation } from "@repo/i18n";

interface ExperimentDevicesContentProps {
  params: Promise<{ id: string }>;
}

export default function ExperimentDevicesContent({ params }: ExperimentDevicesContentProps) {
  const { id } = use(params);
  const { t } = useTranslation("iot");
  const { data: accessData, isLoading, error } = useExperimentAccess(id);

  return (
    <EntityLayoutShell
      isLoading={isLoading}
      error={error}
      hasData={Boolean(accessData?.experiment)}
      loadingMessage={t("iot.experimentDevices.loading")}
    >
      <PageContainer width="fluid" className="gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">{t("iot.experimentDevices.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("iot.experimentDevices.description")}</p>
        </div>

        <ExperimentDevicesPanel experimentId={id} />
      </PageContainer>
    </EntityLayoutShell>
  );
}
