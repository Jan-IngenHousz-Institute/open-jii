"use client";

import { ExperimentDevicesPanel } from "@/components/experiment-settings/devices/experiment-devices-panel";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { notFound } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { use } from "react";

import { FEATURE_FLAGS } from "@repo/analytics";
import { useTranslation } from "@repo/i18n";

interface ExperimentDevicesPageProps {
  params: Promise<{ id: string }>;
}

export default function ExperimentDevicesPage({ params }: ExperimentDevicesPageProps) {
  const { id } = use(params);
  const { t } = useTranslation("iot");
  // undefined while flags load; render nothing to avoid flashing a gated page
  const devicesEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.IOT_DEVICES);
  const { data: accessData, isLoading, error } = useExperimentAccess(id);

  if (devicesEnabled === false) {
    notFound();
  }
  if (!devicesEnabled) {
    return null;
  }

  return (
    <EntityLayoutShell
      isLoading={isLoading}
      error={error}
      hasData={Boolean(accessData?.body.experiment)}
      loadingMessage={t("iot.experimentDevices.loading")}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">{t("iot.experimentDevices.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("iot.experimentDevices.description")}</p>
        </div>

        <ExperimentDevicesPanel experimentId={id} />
      </div>
    </EntityLayoutShell>
  );
}
