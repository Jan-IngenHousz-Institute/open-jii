"use client";

import { useExperimentCreate } from "@/hooks/experiment/useExperimentCreate/useExperimentCreate";
import { useCreateFlowWithSteps } from "@/hooks/flow/useCreateFlowWithSteps/useCreateFlowWithSteps";
import { useLocale } from "@/hooks/useLocale";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Node, Edge } from "@xyflow/react";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";

import type { CreateExperimentBody } from "@repo/api";
import { zCreateExperimentBody } from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button, Form } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { transformFlowDataForAPI } from "../react-flow/flow-utils";
import { NewExperimentDetailsCard } from "./new-experiment-details-card";
import { NewExperimentFlow } from "./new-experiment-flow";
import { NewExperimentMembersCard } from "./new-experiment-members-card";
import { NewExperimentProtocolsCard } from "./new-experiment-protocols-card";
import { NewExperimentVisibilityCard } from "./new-experiment-visibility-card";

// Helper function to transform React Flow edges to API connections
export function NewExperimentForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocale();

  // State to capture flow data
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);

  // Callback to receive flow state changes
  const handleFlowStateChange = useCallback((nodes: Node[], edges: Edge[]) => {
    setFlowNodes(nodes);
    setFlowEdges(edges);
  }, []);

  const { mutate: createFlow } = useCreateFlowWithSteps({
    onSuccess: (flowWithGraph) => {
      // Now create the experiment with the flow ID
      const experimentData = form.getValues();
      createExperiment({
        body: {
          ...experimentData,
          flowId: flowWithGraph.id, // Use the flow ID from the response
        },
      });
    },
  });

  const { mutate: createExperiment, isPending } = useExperimentCreate({
    onSuccess: (experimentId: string) => {
      toast({ description: t("experiments.experimentCreated") });
      router.push(`/${locale}/platform/experiments/${experimentId}`);
    },
  });

  const form = useForm<CreateExperimentBody>({
    resolver: zodResolver(zCreateExperimentBody),
    defaultValues: {
      name: "",
      description: "",
      visibility: zExperimentVisibility.enum.public,
      embargoIntervalDays: 90,
      members: [],
    },
  });

  function cancel() {
    router.back();
  }

  function onSubmit(data: CreateExperimentBody) {
    // Create a flow with the current flow state first
    const flowData = transformFlowDataForAPI(flowNodes, flowEdges);
    // Only create flow if we have steps, otherwise create experiment directly
    if (flowData.steps.length > 0) {
      createFlow({
        body: flowData,
      });
    } else {
      createExperiment({
        body: data,
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Card 1: Name & Description */}
        <NewExperimentDetailsCard form={form} />

        {/* Card 2: Add Members & Card 4: Visibility & Embargo (same row) */}
        <div className="flex flex-col gap-6 md:flex-row">
          <NewExperimentMembersCard form={form} />
          <NewExperimentVisibilityCard form={form} />
        </div>

        {/* Card 3: Add Protocols (new row) */}
        <div className="flex flex-col gap-6">
          <NewExperimentProtocolsCard form={form} />
        </div>

        {/* Experiment Flow Diagram */}
        <NewExperimentFlow onFlowStateChange={handleFlowStateChange} />

        <div className="flex gap-2">
          <Button type="button" onClick={cancel} variant="outline">
            {t("newExperiment.cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("newExperiment.creating") : t("newExperiment.finalizeSetup")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
