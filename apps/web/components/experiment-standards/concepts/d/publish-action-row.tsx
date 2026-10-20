"use client";

import { PublishDatasetButton } from "@/components/datasets/publish-dataset-button";
import type { ReadinessStep } from "@/components/experiment-standards/concepts/readiness-steps";
import { Check, Lock, Plus } from "lucide-react";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

import { StepNumber } from "./step-number";
import { StepStandards } from "./step-standards";

interface PublishActionRowProps {
  experimentId: string;
  /** Zenodo allows one unpublished version at a time, so an open Draft is resumed. */
  draft: Dataset | undefined;
  /** Publishing as a step, naming the followed standards it fills, while one needs a dataset. */
  step: ReadinessStep | undefined;
  waitingFor: number;
}

/** The last row of the steps: Publish, held while any step above remains. */
export function PublishActionRow({ experimentId, draft, step, waitingFor }: PublishActionRowProps) {
  const { t } = useTranslation("readinessConceptD");
  const { t: tDatasets } = useTranslation("datasets");

  const isWaiting = waitingFor > 0;
  const status = isWaiting
    ? t("steps.publishWaits", { count: waitingFor })
    : t("steps.publishReady");

  return (
    <li className={cn("flex items-center gap-3 px-4 py-3", isWaiting && "bg-muted/30")}>
      <StepNumber>
        {isWaiting ? (
          <Lock aria-hidden className="size-3" />
        ) : (
          <Check aria-hidden className="size-3" />
        )}
      </StepNumber>

      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn("text-sm font-medium", isWaiting && "text-muted-foreground")}>{status}</p>
        {step ? <StepStandards standards={step.standards} /> : null}
      </div>

      {isWaiting ? (
        <Button className="shrink-0" disabled>
          <Plus className="size-4" />
          {tDatasets("list.publish")}
        </Button>
      ) : (
        <PublishDatasetButton experimentId={experimentId} draft={draft} />
      )}
    </li>
  );
}
