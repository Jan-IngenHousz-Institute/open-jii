"use client";

import { formatList } from "@/components/calibrations/format-list";
import { StandardFieldsSheet } from "@/components/experiment-standards/standard-fields-sheet";
import { SettingsCard } from "@/components/shared/settings-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useState } from "react";
import { useLocale } from "~/hooks/useLocale";

import type {
  StandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { ChooseStandardsDialog } from "./choose-standards-dialog";
import { FollowedStandardCard } from "./followed-standard-card";
import { FollowedStepList } from "./followed-step-list";
import type { FollowedReadiness } from "./use-followed-readiness";
import { REQUIRED_STANDARD } from "./use-followed-standards";

interface FollowedStandardsCheckProps {
  experimentId: string;
  readiness: FollowedReadiness;
  followed: StandardId[];
  onFollowedChange: (followed: StandardId[]) => void;
  /** Next was pressed while steps remain. */
  isBlocked: boolean;
}

/** The standards the trial follows, which hold the freeze until their steps are done. */
export function FollowedStandardsCheck({
  experimentId,
  readiness,
  followed,
  onFollowedChange,
  isBlocked,
}: FollowedStandardsCheckProps) {
  const { t } = useTranslation("readinessConceptD");
  const { t: tStandards } = useTranslation("standards");
  const locale = useLocale();
  const [isChoosing, setIsChoosing] = useState(false);
  const [openStandard, setOpenStandard] = useState<StandardId | null>(null);

  const steps = readiness.stepsBeforePublishing;
  const hasStepsLeft = steps.length > 0;
  // The floor above already checks the one every trial follows.
  const standards = readiness.followed.filter((row) => row.standard !== REQUIRED_STANDARD);

  const names = formatList(
    locale,
    readiness.waitingOn.map((standard) => tStandards(`destination.${standard}`)),
  );
  const description = hasStepsLeft
    ? t("check.description", { count: readiness.waitingOn.length, names })
    : t("check.allMet");
  const verdict = hasStepsLeft ? (
    <StatusBadge tone="destructive">{t("check.stepsLeft", { count: steps.length })}</StatusBadge>
  ) : (
    <StatusBadge tone="active">{t("check.met")}</StatusBadge>
  );

  const openChooser = () => setIsChoosing(true);
  const closeChooser = () => setIsChoosing(false);
  const closePanel = () => setOpenStandard(null);

  const saveChoice = (chosen: StandardId[]) => {
    onFollowedChange(chosen);
    setIsChoosing(false);
  };

  const renderStandard = (standard: StandardReadiness) => (
    <FollowedStandardCard key={standard.standard} readiness={standard} onOpen={setOpenStandard} />
  );

  return (
    <SettingsCard
      title={t("check.title")}
      description={description}
      action={verdict}
      contentClassName="space-y-4"
      data-testid="followed-standards-check"
    >
      <ul className="grid gap-3 sm:grid-cols-2">{standards.map(renderStandard)}</ul>

      {hasStepsLeft ? (
        <div className="overflow-hidden rounded-lg border">
          <FollowedStepList experimentId={experimentId} steps={steps} />
        </div>
      ) : null}

      {isBlocked ? <p className="text-destructive text-sm">{t("check.blocked")}</p> : null}

      <Button variant="link" className="h-auto p-0" onClick={openChooser}>
        {t("check.change")}
      </Button>

      {isChoosing ? (
        <ChooseStandardsDialog
          standards={readiness.all}
          followed={followed}
          onSave={saveChoice}
          onClose={closeChooser}
        />
      ) : null}

      {openStandard ? (
        <StandardFieldsSheet
          experimentId={experimentId}
          standard={openStandard}
          onClose={closePanel}
        />
      ) : null}
    </SettingsCard>
  );
}
