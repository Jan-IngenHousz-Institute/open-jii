"use client";

import type { Experiment, ExperimentMember } from "@repo/api";
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

  const currentUserRole = members.find((m) => m.user.id === currentUserId)?.role ?? "member";
  const isAdmin = currentUserRole === "admin";

  const isArchived = experiment.status === "archived";

  return (
    <>
      <div className="mt-8">
        <p className="text-muted-foreground mb-2 text-sm">{t("experimentSettings.archiveNote")}</p>

        <div className="flex flex-col gap-3 md:flex-row">
          <ExperimentArchive
            experimentId={experimentId}
            isArchived={isArchived}
            isAdmin={isAdmin}
          />

          <ExperimentDelete experimentId={experimentId} experimentName={experiment.name} />
        </div>
      </div>
    </>
  );
}
