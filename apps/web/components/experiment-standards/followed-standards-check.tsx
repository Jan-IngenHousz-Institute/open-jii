"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useState } from "react";

import type {
  StandardId,
  StepReasonCode,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { ChooseStandardsDialog } from "./choose-standards-dialog";
import { StandardFieldsSheet } from "./standard-fields-sheet";
import { StandardsStepList } from "./standards-step-list";
import { useFollowedStandards } from "./use-followed-standards";

interface OpenFields {
  standard: StandardId;
  first: StepReasonCode;
}

interface FollowedStandardsCheckProps {
  experimentId: string;
  /** Next was pressed while steps hold Freeze, which is the only time this turns red. */
  isBlocked: boolean;
}

/** The publish flow's Check step shows the same steps as the Datasets tab, which hold Freeze. */
export function FollowedStandardsCheck({ experimentId, isBlocked }: FollowedStandardsCheckProps) {
  const { t } = useTranslation("standards");
  const { followed, isLoading, isError, refetch } = useFollowedStandards(experimentId);
  const { data: access } = useExperimentAccess(experimentId);
  const [isChoosing, setIsChoosing] = useState(false);
  const [openFields, setOpenFields] = useState<OpenFields | null>(null);

  const isArchived = access?.experiment.status === "archived";
  const canChange = Boolean(access?.isAdmin) && !isArchived;
  const canFix = Boolean(access?.hasAccess) && !isArchived;

  const openChooser = () => setIsChoosing(true);
  const closeChooser = () => setIsChoosing(false);
  const closeFields = () => setOpenFields(null);
  const openStep = (standard: StandardId, first: StepReasonCode) =>
    setOpenFields({ standard, first });

  const handleRetry = () => {
    void refetch();
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || followed === undefined) {
    return (
      <EmptyState
        variant="error"
        description={t("follows.loadError")}
        action={
          <Button variant="outline" size="sm" onClick={handleRetry}>
            {t("follows.retry")}
          </Button>
        }
      />
    );
  }

  const { steps, holding } = followed;
  const isHeld = holding > 0;
  const verdict = isHeld ? (
    <StatusBadge tone={isBlocked ? "destructive" : "stale"}>
      {t("follows.stepsLeft", { count: holding })}
    </StatusBadge>
  ) : (
    <StatusBadge tone="active">{t("check.ready")}</StatusBadge>
  );

  return (
    <SettingsCard
      title={t("check.title")}
      description={t("check.description")}
      action={verdict}
      contentClassName="space-y-4"
      data-testid="followed-standards-check"
    >
      {steps.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <StandardsStepList
            experimentId={experimentId}
            steps={steps}
            canFix={canFix}
            onOpenFields={openStep}
          />
        </div>
      ) : null}

      {isBlocked && isHeld ? (
        <p className="text-destructive text-sm">{t("check.blocked", { count: holding })}</p>
      ) : null}

      {canChange ? (
        <Button variant="link" className="h-auto p-0" onClick={openChooser}>
          {t("check.change")}
        </Button>
      ) : null}

      {isChoosing ? (
        <ChooseStandardsDialog
          experimentId={experimentId}
          standards={followed.all}
          chosen={followed.chosen}
          onClose={closeChooser}
        />
      ) : null}

      {openFields ? (
        <StandardFieldsSheet
          experimentId={experimentId}
          standard={openFields.standard}
          first={openFields.first}
          canFix={canFix}
          onClose={closeFields}
        />
      ) : null}
    </SettingsCard>
  );
}
