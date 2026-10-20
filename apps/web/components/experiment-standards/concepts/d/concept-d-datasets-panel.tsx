"use client";

import { ExperimentDatasetsPanel } from "@/components/datasets/experiment-datasets-panel";

import { PublishGateBanner } from "./publish-gate-banner";
import { useFollowedReadiness } from "./use-followed-readiness";
import { useFollowedStandards } from "./use-followed-standards";

interface ConceptDDatasetsPanelProps {
  experimentId: string;
  canPublish: boolean;
}

/** Concept D on the Datasets tab: publishing waits until the standards the trial follows are met. */
export function ConceptDDatasetsPanel({ experimentId, canPublish }: ConceptDDatasetsPanelProps) {
  const { followed } = useFollowedStandards();
  const readiness = useFollowedReadiness(experimentId, followed);

  const hasStepsLeft = readiness !== undefined && readiness.stepsBeforePublishing.length > 0;
  // Closed until readiness answers too, so Publish never opens for a moment and then closes.
  const isPublishOpen = readiness !== undefined && !hasStepsLeft;

  return (
    <>
      {canPublish && hasStepsLeft ? (
        <PublishGateBanner
          experimentId={experimentId}
          followed={followed}
          waitingOn={readiness.waitingOn}
          stepCount={readiness.stepsBeforePublishing.length}
        />
      ) : null}

      <ExperimentDatasetsPanel
        experimentId={experimentId}
        canPublish={canPublish && isPublishOpen}
      />
    </>
  );
}
