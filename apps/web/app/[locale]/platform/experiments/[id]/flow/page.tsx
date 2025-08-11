"use client";

import { ErrorDisplay } from "@/components/error-display";
import { FlowEditor } from "@/components/flow-editor";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { useExperimentFlow } from "@/hooks/experiment/useExperimentFlow/useExperimentFlow";
import { useExperimentFlowCreate } from "@/hooks/experiment/useExperimentFlowCreate/useExperimentFlowCreate";
import { useExperimentFlowUpdate } from "@/hooks/experiment/useExperimentFlowUpdate/useExperimentFlowUpdate";
import { use, useState, useCallback } from "react";

import type { UpsertFlowBody } from "@repo/api";
import type { Locale } from "@repo/i18n";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

interface ExperimentFlowPageProps {
  params: Promise<{ id: string; locale: Locale }>;
}

export default function ExperimentFlowPage({ params }: ExperimentFlowPageProps) {
  const { id } = use(params);
  const { data: experiment, isLoading, error } = useExperiment(id);
  const { t } = useTranslation("experiments");

  // Get existing flow for this experiment
  const experimentData = experiment?.body;
  const { data: existingFlow, refetch } = useExperimentFlow(id);

  // Flow state
  const [currentFlowData, setCurrentFlowData] = useState<UpsertFlowBody | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const createFlowMutation = useExperimentFlowCreate({
    onSuccess: () => {
      toast({ description: "Flow created successfully" });
      setHasUnsavedChanges(false);
      void refetch();
    },
    onError: (error) => {
      console.error("Create flow error:", error);
      toast({ description: "Failed to create flow", variant: "destructive" });
    },
  });

  const updateFlowMutation = useExperimentFlowUpdate({
    onSuccess: () => {
      toast({ description: "Flow updated successfully" });
      setHasUnsavedChanges(false);
      void refetch();
    },
    onError: (error) => {
      console.error("Update flow error:", error);
      toast({ description: "Failed to update flow", variant: "destructive" });
    },
  });

  const handleFlowChange = useCallback((flowData: UpsertFlowBody) => {
    setCurrentFlowData(flowData);
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = () => {
    if (!currentFlowData) return;

    if (existingFlow?.body) {
      // Update existing flow
      updateFlowMutation.mutate({
        params: { id },
        body: currentFlowData,
      });
    } else {
      // Create new flow
      createFlowMutation.mutate({
        params: { id },
        body: currentFlowData,
      });
    }
  };

  if (isLoading) {
    return <div>{t("loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("failedToLoad")} />;
  }

  if (!experimentData) {
    return <div>{t("notFound")}</div>;
  }

  const isSaving = createFlowMutation.isPending || updateFlowMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-medium">{t("flow.title")}</h4>
          <p className="text-muted-foreground text-sm">{t("flow.description")}</p>
        </div>

        <Button onClick={handleSave} disabled={!hasUnsavedChanges || isSaving} className="ml-auto">
          {isSaving ? "Saving..." : "Save Flow"}
        </Button>
      </div>

      <FlowEditor
        initialFlow={existingFlow?.body}
        onFlowChange={handleFlowChange}
        onNodeSelect={() => {
          // Handle node selection if needed
        }}
      />
    </div>
  );
}
