"use client";

import { ErrorDisplay } from "@/components/error-display";
import { FlowEditor } from "@/components/flow-editor";
import type { FlowEditorHandle } from "@/components/flow-editor";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentFlow } from "@/hooks/experiment/useExperimentFlow/useExperimentFlow";
import { notFound } from "next/navigation";
import { use, useRef } from "react";

import { useTranslation } from "@repo/i18n/client";

interface ExperimentFlowPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default function ExperimentFlowPage({ params }: ExperimentFlowPageProps) {
  const { id } = use(params);
  const { data: experiment, isLoading, error } = useExperiment(id);
  const {
    data: accessData,
    isLoading: accessLoading,
    error: accessError,
  } = useExperimentAccess(id);
  const { t } = useTranslation("experiments");

  // Get existing flow for this experiment
  const experimentData = experiment?.body;
  const { data: existingFlow } = useExperimentFlow(id);

  // Flow state / editor ref
  const flowEditorRef = useRef<FlowEditorHandle | null>(null);

  if (isLoading || accessLoading) {
    return <div>{t("loading")}</div>;
  }

  if (error ?? accessError) {
    return <ErrorDisplay error={error ?? accessError} title={t("failedToLoad")} />;
  }

  if (!experimentData || !accessData?.body.experiment) {
    return <div>{t("notFound")}</div>;
  }

  // Check if experiment is archived - if not, redirect to not found
  if (experimentData.status !== "archived") {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("flow.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("flow.staticDescription")}</p>
        </div>
        <div className={`flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1.5`}>
          <div className={`h-2 w-2 rounded-full bg-blue-500`}></div>
          <span className={`text-sm font-medium text-blue-700`}>{t("previewMode")}</span>
        </div>
      </div>

      <FlowEditor ref={flowEditorRef} initialFlow={existingFlow?.body} isDisabled={true} />
    </div>
  );
}
