"use client";

import type { StandardReadiness } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

interface DestinationCompanionLineProps {
  readiness: StandardReadiness;
}

/** A standard scored at the same destination, such as FAIR once a dataset is out. */
export function DestinationCompanionLine({ readiness }: DestinationCompanionLineProps) {
  const { t } = useTranslation("readinessConceptB");
  const { t: tStandards } = useTranslation("standards");
  const { standard, state, reason } = readiness;

  const name = tStandards(`destination.${standard}`);
  const isWaitingForDataset = reason.code === "no-published-dataset";

  return (
    <p className="text-muted-foreground text-xs">
      {isWaitingForDataset
        ? t("companion.afterPublishing", { name })
        : t("companion.state", { name, state: tStandards(`state.${state}`) })}
    </p>
  );
}
