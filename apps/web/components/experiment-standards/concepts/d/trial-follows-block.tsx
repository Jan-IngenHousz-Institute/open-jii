"use client";

import { StandardFieldsSheet } from "@/components/experiment-standards/standard-fields-sheet";
import { useState } from "react";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";
import type {
  StandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";

import { ChooseStandardsDialog } from "./choose-standards-dialog";
import { FollowedStandardCard } from "./followed-standard-card";
import { FollowedStepList } from "./followed-step-list";
import { PublishActionRow } from "./publish-action-row";
import type { FollowedReadiness } from "./use-followed-readiness";

interface TrialFollowsBlockProps {
  experimentId: string;
  readiness: FollowedReadiness;
  followed: StandardId[];
  onFollowedChange: (followed: StandardId[]) => void;
  canPublish: boolean;
  draft: Dataset | undefined;
}

/** What the trial follows, the steps they still need, and Publish last, held until those are done. */
export function TrialFollowsBlock({
  experimentId,
  readiness,
  followed,
  onFollowedChange,
  canPublish,
  draft,
}: TrialFollowsBlockProps) {
  const { t } = useTranslation("readinessConceptD");
  const [isChoosing, setIsChoosing] = useState(false);
  const [openStandard, setOpenStandard] = useState<StandardId | null>(null);

  const steps = readiness.stepsBeforePublishing;
  const hasRows = steps.length > 0 || canPublish;

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
    <section className="space-y-3" data-testid="trial-follows">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{t("follows.title")}</h3>
        <Button variant="link" className="h-auto shrink-0 p-0" onClick={openChooser}>
          {t("follows.change")}
        </Button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">{readiness.followed.map(renderStandard)}</ul>

      <Card padding="none" className="overflow-hidden shadow-none">
        <CardContent className="p-0">
          {hasRows ? (
            <FollowedStepList experimentId={experimentId} steps={steps}>
              {canPublish ? (
                <PublishActionRow
                  experimentId={experimentId}
                  draft={draft}
                  step={readiness.publishStep}
                  waitingFor={steps.length}
                />
              ) : null}
            </FollowedStepList>
          ) : (
            <p className="text-muted-foreground px-4 py-3 text-sm">{t("steps.allMet")}</p>
          )}
        </CardContent>
      </Card>

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
    </section>
  );
}
