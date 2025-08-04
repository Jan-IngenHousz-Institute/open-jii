"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import type { Node, Edge } from "@xyflow/react";
import { use } from "react";
import { NewExperimentFlow } from "~/components/new-experiment/new-experiment-flow";

import type { Locale } from "@repo/i18n";
import { useTranslation } from "@repo/i18n/client";

interface ExperimentFlowPageProps {
  params: Promise<{ id: string; locale: Locale }>;
}

export default function ExperimentFlowPage({ params }: ExperimentFlowPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useExperiment(id);
  const { t } = useTranslation("experiments");

  if (isLoading) {
    return <div>{t("loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("failedToLoad")} />;
  }

  if (!data) {
    return <div>{t("notFound")}</div>;
  }

  const handleFlowStateChange = (nodes: Node[], edges: Edge[]) => {
    // TODO: Save flow state to the experiment
    console.log("Flow state changed:", { nodes, edges });
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-medium">{t("flow.title")}</h4>
        <p className="text-muted-foreground text-sm">{t("flow.description")}</p>
      </div>

      <NewExperimentFlow
        onFlowStateChange={handleFlowStateChange}
        onNodeSelect={(node) => {
          // Handle node selection if needed
          console.log("Node selected:", node);
        }}
      />
    </div>
  );
}
