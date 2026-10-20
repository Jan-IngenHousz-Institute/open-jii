"use client";

import { STANDARDS_READINESS_ANCHOR } from "@/components/experiment-overview/experiment-readiness-summary";
import { useState } from "react";

import { ReadinessStepsSheet } from "./c/readiness-steps-sheet";
import { ReadinessStrip } from "./c/readiness-strip";
import { useReadinessOverview } from "./readiness-steps";

interface ReadinessConceptCProps {
  experimentId: string;
}

/**
 * Concept C: no readiness screen. The Overview keeps one strip, and the hints sit where the
 * missing data is entered, in the locations section and the data dictionary.
 */
export function ReadinessConceptC({ experimentId }: ReadinessConceptCProps) {
  const overview = useReadinessOverview(experimentId);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  if (!overview) {
    return null;
  }

  const openSheet = () => setIsSheetOpen(true);
  const closeSheet = () => setIsSheetOpen(false);

  return (
    <section id={STANDARDS_READINESS_ANCHOR} data-concept="c" className="scroll-mt-6">
      <ReadinessStrip overview={overview} onOpen={openSheet} />

      {isSheetOpen && (
        <ReadinessStepsSheet experimentId={experimentId} overview={overview} onClose={closeSheet} />
      )}
    </section>
  );
}
