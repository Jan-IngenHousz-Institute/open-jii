"use client";

import { useFeatureFlagEnabled } from "posthog-js/react";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Separator } from "@repo/ui/components/separator";

import { ExperimentArchive } from "./experiment-archive";
import { ExperimentDelete } from "./experiment-delete";

interface ExperimentInfoCardProps {
  experimentId: string;
  experiment: Experiment;
  /** `can(manage)` from the experiment-access response. */
  canManage: boolean;
}

export function ExperimentInfoCard({
  experimentId,
  experiment,
  canManage,
}: ExperimentInfoCardProps) {
  const { t } = useTranslation();

  // The roster carries no tier since the members→grants consolidation, so
  // "can this person administer the experiment" is the server's can() answer.
  const isAdmin = canManage;
  const isDeletionEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.EXPERIMENT_DELETION);

  const isArchived = experiment.status === "archived";

  if (!isAdmin) return null;

  return (
    <>
      <Separator decorative={false} className="mx-4 my-4 w-auto" />
      <div className="px-6 pb-4">
        <p className="text-muted-foreground mb-2 text-sm">
          {t(
            isDeletionEnabled
              ? "experimentSettings.dangerZoneNote_deleteAllowed"
              : "experimentSettings.dangerZoneNote",
          )}
        </p>

        <div className="flex flex-col gap-3 md:flex-row">
          <ExperimentArchive experimentId={experimentId} isArchived={isArchived} />

          <ExperimentDelete experimentId={experimentId} experimentName={experiment.name} />
        </div>
      </div>
    </>
  );
}
