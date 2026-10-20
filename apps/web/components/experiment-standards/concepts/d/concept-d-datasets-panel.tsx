"use client";

import { ExperimentDatasetsPanel } from "@/components/datasets/experiment-datasets-panel";
import { useExperimentDatasets } from "@/hooks/dataset/useExperimentDatasets/useExperimentDatasets";

import { TrialFollowsBlock } from "./trial-follows-block";
import { useFollowedReadiness } from "./use-followed-readiness";
import { useFollowedStandards } from "./use-followed-standards";

interface ConceptDDatasetsPanelProps {
  experimentId: string;
  canPublish: boolean;
}

/**
 * Concept D on the Datasets tab: what the trial follows and its steps sit above the list, and
 * Publish is their last row, so the list below carries no Publish of its own.
 */
export function ConceptDDatasetsPanel({ experimentId, canPublish }: ConceptDDatasetsPanelProps) {
  const { followed, setFollowed } = useFollowedStandards();
  const readiness = useFollowedReadiness(experimentId, followed);
  const { data: datasets } = useExperimentDatasets(experimentId);

  const draft = datasets?.find((dataset) => dataset.state === "draft");

  return (
    <>
      {readiness ? (
        <TrialFollowsBlock
          experimentId={experimentId}
          readiness={readiness}
          followed={followed}
          onFollowedChange={setFollowed}
          canPublish={canPublish}
          draft={draft}
        />
      ) : null}

      <ExperimentDatasetsPanel experimentId={experimentId} canPublish={false} />
    </>
  );
}
