"use client";

import { ErrorDisplay } from "@/components/error-display";
import { FlowEditor } from "@/components/flow-editor";
import type { FlowEditorHandle } from "@/components/flow-editor";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
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
  const {
    data: accessData,
    isLoading: accessLoading,
    error: accessError,
  } = useExperimentAccess(id);
  const { t } = useTranslation("experiments");

  // Get existing flow for this experiment
  const experimentData = experiment?.body;
  const { data: existingFlow, refetch } = useExperimentFlow(id);

  // Determine if user has access to edit
  const hasAccess = accessData?.body.hasAccess ?? false;

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

  if (isLoading || accessLoading) {
    return <div>{t("loading")}</div>;
  }

  if (error ?? accessError) {
    return <ErrorDisplay error={error ?? accessError} title={t("failedToLoad")} />;
  }

  if (!experimentData || !accessData?.body.experiment) {
    return <div>{t("notFound")}</div>;
  }

  const isSaving = createFlowMutation.isPending || updateFlowMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("flow.title")}</h2>
          <p className="text-muted-foreground text-sm">
            {hasAccess ? t("flow.editDescription") : t("flow.staticDescription")}
          </p>
        </div>
        <div
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 ${hasAccess ? "bg-green-50" : "bg-blue-50"}`}
        >
          <div
            className={`h-2 w-2 rounded-full ${hasAccess ? "bg-green-500" : "bg-blue-500"}`}
          ></div>
          <span className={`text-sm font-medium ${hasAccess ? "text-green-700" : "text-blue-700"}`}>
            {hasAccess ? "Editing Mode" : "Preview Mode"}
          </span>
        </div>
      </div>

      <FlowEditor
        ref={flowEditorRef}
        initialFlow={existingFlow?.body}
        isDisabled={!hasAccess}
        onDirtyChange={hasAccess ? () => setHasUnsavedChanges(true) : undefined}
      />

      {hasAccess && (
        <div className="flex items-center justify-end gap-4">
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="bg-jii-dark-green hover:bg-jii-medium-green"
          >
            {isSaving ? t("flow.saving") : t("flow.saveFlow")}
          </Button>
        </div>
      )}
    </div>
  );
}
