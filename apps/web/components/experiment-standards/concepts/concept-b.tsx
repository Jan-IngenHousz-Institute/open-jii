"use client";

import { STANDARDS_READINESS_ANCHOR } from "@/components/experiment-overview/experiment-readiness-summary";
import { DestinationCard } from "@/components/experiment-standards/concepts/b/destination-card";
import { NotApplicableLine } from "@/components/experiment-standards/concepts/b/not-applicable-line";
import type { ReadinessDestination } from "@/components/experiment-standards/concepts/b/readiness-destinations";
import { readinessDestinations } from "@/components/experiment-standards/concepts/b/readiness-destinations";
import { useReadinessOverview } from "@/components/experiment-standards/concepts/readiness-steps";
import { StandardFieldsSheet } from "@/components/experiment-standards/standard-fields-sheet";
import { useState } from "react";

import type { StandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

interface ReadinessConceptBProps {
  experimentId: string;
}

/** Readiness by destination: where the data can go, how far it is, and the steps left for each. */
export function ReadinessConceptB({ experimentId }: ReadinessConceptBProps) {
  const { t } = useTranslation("readinessConceptB");
  const overview = useReadinessOverview(experimentId);
  const [openStandard, setOpenStandard] = useState<StandardId | null>(null);

  if (!overview) {
    return null;
  }

  const { destinations, notApplicable } = readinessDestinations(overview);
  const ready = destinations.filter((destination) => destination.readiness.state === "met").length;
  const hasNotApplicable = notApplicable.length > 0;

  const closeSheet = () => setOpenStandard(null);

  const renderDestination = (destination: ReadinessDestination) => (
    <DestinationCard
      key={destination.readiness.standard}
      experimentId={experimentId}
      destination={destination}
      onOpen={setOpenStandard}
    />
  );

  return (
    <section id={STANDARDS_READINESS_ANCHOR} className="scroll-mt-6 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold">{t("title")}</h2>
        <span className="text-muted-foreground text-sm">
          {t("readyCount", { ready, total: destinations.length })}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">{destinations.map(renderDestination)}</div>

      {hasNotApplicable && <NotApplicableLine standards={notApplicable} />}

      {openStandard && (
        <StandardFieldsSheet
          experimentId={experimentId}
          standard={openStandard}
          onClose={closeSheet}
        />
      )}
    </section>
  );
}
