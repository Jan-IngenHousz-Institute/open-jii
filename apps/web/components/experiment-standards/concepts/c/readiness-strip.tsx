"use client";

import type { StandardReadiness } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";

import type { ReadinessOverview } from "../readiness-steps";
import { ReadinessRing } from "./readiness-ring";
import { useReadinessSentence } from "./use-readiness-sentence";

/** Fields filled and wanted across every standard that applies and counts them. */
function countFields(standards: readonly StandardReadiness[]): { filled: number; total: number } {
  const counted = standards.filter((row) => row.state !== "not-applicable");
  return {
    filled: counted.reduce((sum, row) => sum + (row.filled ?? 0), 0),
    total: counted.reduce((sum, row) => sum + (row.total ?? 0), 0),
  };
}

interface ReadinessStripProps {
  overview: ReadinessOverview;
  onOpen: () => void;
}

/** The whole of readiness on the Overview: a ring, one sentence and the way into the steps. */
export function ReadinessStrip({ overview, onOpen }: ReadinessStripProps) {
  const { t } = useTranslation("readinessConceptC");
  const { ready, remaining } = useReadinessSentence(overview);
  const { filled, total } = countFields(overview.standards);

  return (
    <Card padding="none" className="shadow-none">
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <ReadinessRing filled={filled} total={total} />
        <p className="min-w-48 flex-1 text-sm">
          {ready && <span className="font-medium">{ready} </span>}
          <span className="text-muted-foreground">{remaining}</span>
        </p>
        <Button variant="link" className="h-auto shrink-0 p-0" onClick={onOpen}>
          {t("strip.seeWhatIsLeft")}
        </Button>
      </CardContent>
    </Card>
  );
}
