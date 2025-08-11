"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { useExperimentFlow } from "@/hooks/experiment/useExperimentFlow/useExperimentFlow";
import { useExperimentFlowCreate } from "@/hooks/experiment/useExperimentFlowCreate/useExperimentFlowCreate";
import { useExperimentFlowUpdate } from "@/hooks/experiment/useExperimentFlowUpdate/useExperimentFlowUpdate";
import type { Node, Edge } from "@xyflow/react";
import { use, useCallback, useState, useEffect } from "react";
import { NewExperimentFlow } from "~/components/new-experiment/new-experiment-flow";
import { transformFlowDataForAPI } from "~/components/react-flow/flow-utils";
import { nodeTypeColorMap } from "~/components/react-flow/node-config";

import type { Locale } from "@repo/i18n";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components";

interface ExperimentFlowPageProps {
  params: Promise<{ id: string; locale: Locale }>;
}

export default function ExperimentFlowPage({ params }: ExperimentFlowPageProps) {
  const { id } = use(params);
  const { data: experiment, isLoading, error } = useExperiment(id);
  const { t } = useTranslation("experiments");

  // State for current flow data
  const [currentNodes, setCurrentNodes] = useState<Node[]>([]);
  const [currentEdges, setCurrentEdges] = useState<Edge[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Get existing flow for this experiment
  const experimentData = experiment?.body;
  const { data: existingFlow } = useExperimentFlow(id);

  // Load existing flow data into React Flow editor
  useEffect(() => {
    if (existingFlow?.body) {
      const flowData = existingFlow.body;

      // Convert API steps to React Flow nodes
      const nodes: Node[] = flowData.steps.map((step) => {
        // Get the configuration for this step type
        const config = nodeTypeColorMap[step.type];

        return {
          id: step.id,
          type: step.type,
          position: step.position,
          sourcePosition: config.defaultSourcePosition,
          targetPosition: config.defaultTargetPosition,
          data: {
            title: step.title,
            description: step.description,
            stepSpecification: step.stepSpecification,
            isStartNode: step.isStartNode,
            isEndNode: step.isEndNode,
          },
          measured: step.size,
        };
      });

      // Convert API connections to React Flow edges
      const edges: Edge[] = flowData.connections.map((connection) => ({
        id: connection.id,
        source: connection.sourceStepId,
        target: connection.targetStepId,
        type: connection.type,
        animated: connection.animated,
        data: {
          condition: connection.condition,
          priority: connection.priority,
        },
      }));

      setCurrentNodes(nodes);
      setCurrentEdges(edges);
      setHasUnsavedChanges(false);
    }
  }, [existingFlow]);

  // Hooks for flow operations
  const createFlowMutation = useExperimentFlowCreate({
    onSuccess: () => {
      setHasUnsavedChanges(false);
    },
  });

  const updateFlowMutation = useExperimentFlowUpdate({
    onSuccess: () => {
      setHasUnsavedChanges(false);
    },
    onError: (error) => {
      console.error("Failed to update flow:", error);
    },
  });

  const handleFlowStateChange = useCallback((nodes: Node[], edges: Edge[]) => {
    setCurrentNodes(nodes);
    setCurrentEdges(edges);
    setHasUnsavedChanges(true);
  }, []);

  const handleSaveFlow = useCallback(() => {
    if (!experimentData) return;

    // Use the utility function to transform React Flow data to API format
    const { steps: flowSteps, connections } = transformFlowDataForAPI(currentNodes, currentEdges);

    if (existingFlow?.body) {
      // Update existing flow
      updateFlowMutation.mutate({
        params: { id },
        body: {
          steps: flowSteps,
          connections,
        },
      });
    } else {
      // Create new flow
      createFlowMutation.mutate({
        params: { id },
        body: {
          steps: flowSteps,
          connections,
        },
      });
    }
  }, [
    id,
    experimentData,
    currentNodes,
    currentEdges,
    existingFlow?.body,
    createFlowMutation,
    updateFlowMutation,
  ]);

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

        {hasUnsavedChanges && (
          <Button onClick={handleSaveFlow} disabled={isSaving} className="ml-auto">
            {isSaving ? t("common.saving") : t("common.save")}
          </Button>
        )}
      </div>

      <NewExperimentFlow
        initialNodes={currentNodes}
        initialEdges={currentEdges}
        onFlowStateChange={handleFlowStateChange}
        onNodeSelect={(_node) => {
          // Handle node selection if needed
        }}
      />
    </div>
  );
}
