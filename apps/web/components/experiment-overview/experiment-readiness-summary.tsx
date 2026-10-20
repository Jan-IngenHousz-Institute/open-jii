"use client";

import { ReadinessConceptA } from "@/components/experiment-standards/concepts/concept-a";
import { ReadinessConceptB } from "@/components/experiment-standards/concepts/concept-b";
import { ReadinessConceptC } from "@/components/experiment-standards/concepts/concept-c";
import { ReadinessConceptD } from "@/components/experiment-standards/concepts/concept-d";
import { StandardFieldsSheet } from "@/components/experiment-standards/standard-fields-sheet";
import { StandardReadinessRow } from "@/components/experiment-standards/standard-readiness-row";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useExperimentStandardsReadiness } from "~/hooks/experiment/useExperimentStandardsReadiness/useExperimentStandardsReadiness";

import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";
import type {
  StandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardContent } from "@repo/ui/components/card";

interface ExperimentReadinessSummaryProps {
  experimentId: string;
  experiment: Experiment;
}

export const STANDARDS_READINESS_ANCHOR = "standards-readiness";

/** The readiness screen: one row per standard and the OpenAIRE floor, each opening its fields. */
export function ExperimentReadinessSummary({ experimentId }: ExperimentReadinessSummaryProps) {
  const { t } = useTranslation("standards");
  const { data } = useExperimentStandardsReadiness(experimentId);
  const [openStandard, setOpenStandard] = useState<StandardId | null>(null);
  // Scaffold: ?readiness=a|b|c|d swaps in a design concept for comparison.
  const concept = useSearchParams().get("readiness");

  if (concept === "a") {
    return <ReadinessConceptA experimentId={experimentId} />;
  }
  if (concept === "b") {
    return <ReadinessConceptB experimentId={experimentId} />;
  }
  if (concept === "c") {
    return <ReadinessConceptC experimentId={experimentId} />;
  }
  if (concept === "d") {
    return <ReadinessConceptD experimentId={experimentId} />;
  }

  // Stays out of the tab until the mapping answers, rather than holding a place for it.
  if (!data) {
    return null;
  }

  const closePanel = () => setOpenStandard(null);

  const renderRow = (readiness: StandardReadiness) => (
    <StandardReadinessRow
      key={readiness.standard}
      readiness={readiness}
      onOpen={setOpenStandard}
    />
  );

  return (
    <section id={STANDARDS_READINESS_ANCHOR} className="scroll-mt-6 space-y-3">
      <h2 className="font-bold">{t("readiness.title")}</h2>

      <Card padding="none" className="overflow-hidden shadow-none">
        <CardContent className="p-0">
          <ul>{data.standards.map(renderRow)}</ul>
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
