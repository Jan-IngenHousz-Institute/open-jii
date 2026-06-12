"use client";

import {
  findMember,
  isAdmin as isAdminRole,
  isExperimentArchived,
} from "@/features/experiments/domain/access";
import { useFeatureFlagEnabled } from "posthog-js/react";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { Experiment, ExperimentMember } from "@repo/api/schemas/experiment.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";

import { ExperimentArchive } from "./experiment-archive";
import { ExperimentDelete } from "./experiment-delete";

interface ExperimentInfoCardProps {
  experimentId: string;
  experiment: Experiment;
  members: ExperimentMember[];
}

export function ExperimentInfoCard({ experimentId, experiment, members }: ExperimentInfoCardProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const currentUserId = session?.user.id;

  const currentMember = findMember(members, currentUserId);
  const isAdmin = isAdminRole(currentMember?.role);
  const isDeletionEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.EXPERIMENT_DELETION);

  const isArchived = isExperimentArchived(experiment);

  if (!isAdmin && !isDeletionEnabled) return null;

  return (
    <>
      <div
        role="separator"
        aria-orientation="horizontal"
        className="text-muted-foreground mx-4 border-t"
      />
      <div className="px-6 py-4">
        {isAdmin && (
          <p className="text-muted-foreground mb-2 text-sm">
            {t(
              isDeletionEnabled
                ? "experimentSettings.dangerZoneNote_deleteAllowed"
                : "experimentSettings.dangerZoneNote",
            )}
          </p>
        )}

        <div className="flex flex-col gap-3 md:flex-row">
          {isAdmin && <ExperimentArchive experimentId={experimentId} isArchived={isArchived} />}

          <ExperimentDelete experimentId={experimentId} experimentName={experiment.name} />
        </div>
      </div>
    </>
  );
}
