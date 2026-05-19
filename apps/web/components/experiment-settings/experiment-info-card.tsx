"use client";

import { useFeatureFlagEnabled } from "posthog-js/react";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { Experiment, ExperimentMember } from "@repo/api/schemas/experiment.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";

import { ExperimentArchive } from "./experiment-archive";
import { ExperimentDelete } from "./experiment-delete";
import { ExperimentRequestToJoin } from "./experiment-request-to-join";

interface ExperimentInfoCardProps {
  experimentId: string;
  experiment: Experiment;
  members: ExperimentMember[];
}

export function ExperimentInfoCard({ experimentId, experiment, members }: ExperimentInfoCardProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const currentUserId = session?.user.id;

  const currentMember = currentUserId
    ? members.find((m) => m.user.id === currentUserId)
    : undefined;
  const isAdmin = currentMember?.role === "admin";
  const isDeletionEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.EXPERIMENT_DELETION);

  const isArchived = experiment.status === "archived";
  const canRequestToJoin =
    !currentMember && !isArchived && currentUserId && experiment.visibility === "public";

  return (
    <>
      <div className="mt-8">
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

          {canRequestToJoin && <ExperimentRequestToJoin experimentId={experimentId} />}

          <ExperimentDelete experimentId={experimentId} experimentName={experiment.name} />
        </div>
      </div>
    </>
  );
}
