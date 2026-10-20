"use client";

import { STANDARDS_READINESS_ANCHOR } from "@/components/experiment-overview/experiment-readiness-summary";
import { StandardFieldsSheet } from "@/components/experiment-standards/standard-fields-sheet";
import { useState } from "react";
import { useExperimentStandardsFields } from "~/hooks/experiment/useExperimentStandardsFields/useExperimentStandardsFields";

import type { StandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardContent } from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";

import { FinishedLine } from "./a/finished-line";
import { finishedWork } from "./a/finished-work";
import { ReadinessStepRow } from "./a/readiness-step-row";
import { stepGains } from "./a/step-gains";
import type { ReadinessStep } from "./readiness-steps";
import { useReadinessOverview } from "./readiness-steps";

interface ReadinessConceptAProps {
  experimentId: string;
}

/** Concept A: the steps left before the trial can be shared, ranked by how much each unlocks. */
export function ReadinessConceptA({ experimentId }: ReadinessConceptAProps) {
  const { t } = useTranslation("readinessConceptA");
  const overview = useReadinessOverview(experimentId);
  const { data: miappe } = useExperimentStandardsFields(experimentId, "miappe");
  const [openStandard, setOpenStandard] = useState<StandardId | null>(null);

  if (!overview || !miappe) {
    return null;
  }

  const finished = finishedWork(overview.standards, miappe);
  const ready = overview.standards.filter((row) => row.state === "met").map((row) => row.standard);
  const total = finished.length + overview.steps.length;
  const percent = total > 0 ? (finished.length / total) * 100 : 0;

  const closePanel = () => setOpenStandard(null);

  const renderStep = (step: ReadinessStep, index: number) => (
    <ReadinessStepRow
      key={step.action}
      experimentId={experimentId}
      step={step}
      position={index + 1}
      gains={stepGains(step, overview.standards, miappe)}
      onOpenStandard={setOpenStandard}
    />
  );

  return (
    <section id={STANDARDS_READINESS_ANCHOR} className="scroll-mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{t("title")}</h2>
        <span className="text-muted-foreground shrink-0 text-sm">
          {t("doneCount", { done: finished.length, total })}
        </span>
      </div>

      <Card padding="none" className="overflow-hidden shadow-none">
        <CardContent className="divide-y p-0">
          <div className="flex items-center gap-3 px-4 py-3">
            <Progress value={percent} aria-label={t("progress")} className="flex-1" />
            <span className="text-muted-foreground shrink-0 text-sm">
              {t("stepsLeft", { count: overview.steps.length })}
            </span>
          </div>

          <ol className="divide-y">{overview.steps.map(renderStep)}</ol>
          <FinishedLine finished={finished} ready={ready} />
        </CardContent>
      </Card>

      {openStandard && (
        <StandardFieldsSheet
          experimentId={experimentId}
          standard={openStandard}
          onClose={closePanel}
        />
      )}
    </section>
  );
}
