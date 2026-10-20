"use client";

import { MapPin } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";

import { useReadinessOverview } from "../readiness-steps";
import { useListJoin } from "./use-list-join";

interface LocationReadinessHintProps {
  experimentId: string;
  canAdd: boolean;
  onAdd: () => void;
}

/** Under an empty locations section: who asks where the trial ran, and the way to add it. */
export function LocationReadinessHint({ experimentId, canAdd, onAdd }: LocationReadinessHintProps) {
  const { t } = useTranslation("readinessConceptC");
  const { t: tStandards } = useTranslation("standards");
  const joinList = useListJoin();
  const overview = useReadinessOverview(experimentId);
  const step = overview?.steps.find((candidate) => candidate.action === "add-location");

  if (!step) {
    return null;
  }

  const askers = joinList(step.standards.map((standard) => tStandards(`destination.${standard}`)));

  return (
    <Alert role="status" className="mt-2 px-3 py-2.5">
      <MapPin />
      <AlertDescription>
        <p className="text-balance">{t("location.askedBy", { askers })}</p>
        {canAdd && (
          <Button variant="link" className="h-auto p-0" onClick={onAdd}>
            {t("location.add")}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
