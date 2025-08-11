"use client";

import { ErrorDisplay } from "@/components/error-display";
import { FlowEditor } from "@/components/flow-editor";
import type { FlowEditorHandle } from "@/components/flow-editor";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { useExperimentFlow } from "@/hooks/experiment/useExperimentFlow/useExperimentFlow";
import { useExperimentFlowCreate } from "@/hooks/experiment/useExperimentFlowCreate/useExperimentFlowCreate";
import { useExperimentFlowUpdate } from "@/hooks/experiment/useExperimentFlowUpdate/useExperimentFlowUpdate";
import { use, useState, useRef, useCallback } from "react";

// UpsertFlowBody type no longer needed directly (constructed on-demand by editor)
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

  // Flow state / editor ref
  const flowEditorRef = useRef<FlowEditorHandle | null>(null);
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

  const handleSave = useCallback(() => {
    const data = flowEditorRef.current ? flowEditorRef.current.getFlowData() : null;
    if (!data) return; // not ready
    if (existingFlow?.body) {
      updateFlowMutation.mutate({ params: { id }, body: data });
    } else {
      createFlowMutation.mutate({ params: { id }, body: data });
    }
  }, [createFlowMutation, updateFlowMutation, existingFlow, id]);

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
        ref={flowEditorRef}
        initialFlow={existingFlow?.body}
        onDirtyChange={() => setHasUnsavedChanges(true)}
      />
    </div>
  );
}
