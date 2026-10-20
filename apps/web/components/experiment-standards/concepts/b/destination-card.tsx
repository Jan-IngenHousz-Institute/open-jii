"use client";

import type { ReadinessStep } from "@/components/experiment-standards/concepts/readiness-steps";
import { StatusBadge } from "@/components/shared/status-badge";

import type {
  StandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardContent } from "@repo/ui/components/card";

import { DestinationCompanionLine } from "./destination-companion-line";
import { DestinationDoneRow } from "./destination-done-row";
import { DestinationProgress } from "./destination-progress";
import { DestinationStepRow } from "./destination-step-row";
import type { DoneItem, ReadinessDestination } from "./readiness-destinations";

interface DestinationCardProps {
  experimentId: string;
  destination: ReadinessDestination;
  onOpen: (standard: StandardId) => void;
}

/** One place the data can go: who uses it there, how far the trial is, and what is left. */
export function DestinationCard({ experimentId, destination, onOpen }: DestinationCardProps) {
  const { t } = useTranslation("readinessConceptB");
  const { t: tStandards } = useTranslation("standards");
  const { readiness, companions, steps, done } = destination;
  const { standard, state, filled, total } = readiness;

  const isMet = state === "met";
  const hasCount = filled !== null && total !== null;
  const showsCount = hasCount && state === "partial";
  const hasChecklist = done.length > 0 || steps.length > 0;

  const standardName = tStandards(`standard.${standard}.name`);
  const subtitle = showsCount ? t("subtitle", { name: standardName, filled, total }) : standardName;
  const status = isMet ? t("status.ready") : t("status.steps", { count: steps.length });

  const handleOpen = () => onOpen(standard);

  const renderDone = (item: DoneItem) => <DestinationDoneRow key={item} item={item} />;

  const renderStep = (step: ReadinessStep) => (
    <DestinationStepRow key={step.action} experimentId={experimentId} step={step} />
  );

  const renderCompanion = (companion: StandardReadiness) => (
    <DestinationCompanionLine key={companion.standard} readiness={companion} />
  );

  return (
    <Card padding="none" className="shadow-none">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={handleOpen}
              className="text-left text-sm font-semibold underline-offset-4 hover:underline"
            >
              {tStandards(`destination.${standard}`)}
            </button>
            <p className="text-muted-foreground text-xs">{subtitle}</p>
          </div>

          <StatusBadge tone={isMet ? "active" : "stale"} className="shrink-0">
            {status}
          </StatusBadge>
        </div>

        {hasCount && <DestinationProgress filled={filled} total={total} isMet={isMet} />}

        <p className="text-muted-foreground text-sm">{t(`audience.${standard}`)}</p>

        {hasChecklist && (
          <ul className="space-y-1.5 border-t pt-3">
            {done.map(renderDone)}
            {steps.map(renderStep)}
          </ul>
        )}

        {companions.map(renderCompanion)}
      </CardContent>
    </Card>
  );
}
