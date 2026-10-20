"use client";

import { STANDARDS_READINESS_ANCHOR } from "@/components/experiment-overview/experiment-readiness-summary";
import { StandardFieldsSheet } from "@/components/experiment-standards/standard-fields-sheet";
import { useState } from "react";

import type {
  StandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";

import { ChooseStandardsDialog } from "./d/choose-standards-dialog";
import { FollowedStandardCard } from "./d/followed-standard-card";
import { FollowedStepList } from "./d/followed-step-list";
import { useFollowedReadiness } from "./d/use-followed-readiness";
import { useFollowedStandards } from "./d/use-followed-standards";

interface ReadinessConceptDProps {
  experimentId: string;
}

/** Concept D: the trial follows the standards it chose, and only their steps show. */
export function ReadinessConceptD({ experimentId }: ReadinessConceptDProps) {
  const { t } = useTranslation("readinessConceptD");
  const { followed, setFollowed } = useFollowedStandards();
  const readiness = useFollowedReadiness(experimentId, followed);
  const [isChoosing, setIsChoosing] = useState(false);
  const [openStandard, setOpenStandard] = useState<StandardId | null>(null);

  if (!readiness) {
    return null;
  }

  const isAllMet = readiness.stepsBeforePublishing.length === 0 && !readiness.publishStep;

  const openChooser = () => setIsChoosing(true);
  const closeChooser = () => setIsChoosing(false);
  const closePanel = () => setOpenStandard(null);

  const saveChoice = (chosen: StandardId[]) => {
    setFollowed(chosen);
    setIsChoosing(false);
  };

  const renderStandard = (standard: StandardReadiness) => (
    <FollowedStandardCard key={standard.standard} readiness={standard} onOpen={setOpenStandard} />
  );

  return (
    <section id={STANDARDS_READINESS_ANCHOR} className="scroll-mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{t("follows.title")}</h2>
        <Button variant="link" className="h-auto shrink-0 p-0" onClick={openChooser}>
          {t("follows.change")}
        </Button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">{readiness.followed.map(renderStandard)}</ul>

      <Card padding="none" className="overflow-hidden shadow-none">
        <CardContent className="p-0">
          {isAllMet ? (
            <p className="text-muted-foreground px-4 py-3 text-sm">{t("steps.allMet")}</p>
          ) : (
            <FollowedStepList
              experimentId={experimentId}
              steps={readiness.stepsBeforePublishing}
              publishStep={readiness.publishStep}
            />
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
