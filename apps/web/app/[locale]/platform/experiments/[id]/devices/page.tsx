"use client";

import { ErrorDisplay } from "@/components/error-display";
import { ExperimentDevicesPanel } from "@/components/experiment-settings/devices/experiment-devices-panel";
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

  if (devicesEnabled === false) notFound();
  if (!devicesEnabled) return null;

  if (isLoading) {
    return (
      <div className="text-muted-foreground mx-auto w-full max-w-7xl p-8 text-center">
        {t("iot.experimentDevices.loading")}
      </div>
    );
  }

  if (error) {
    const errorObj = error as { status?: number };
    if (errorObj.status === 404 || errorObj.status === 400) notFound();
    return (
      <div className="mx-auto w-full max-w-7xl">
        <ErrorDisplay error={error} />
      </div>
    );
  }

  if (!accessData?.body.experiment) notFound();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{t("iot.experimentDevices.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("iot.experimentDevices.description")}</p>
      </div>

      <ExperimentDevicesPanel experimentId={id} />
    </div>
  );
}
