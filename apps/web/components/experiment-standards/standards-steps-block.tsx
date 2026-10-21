"use client";

import { useExperimentDatasets } from "@/hooks/dataset/useExperimentDatasets/useExperimentDatasets";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useState } from "react";

import type {
  StandardId,
  StandardReadiness,
  StepReasonCode,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { ChooseStandardsDialog } from "./choose-standards-dialog";
import { FollowedStandardCard } from "./followed-standard-card";
import { PublishDatasetRow } from "./publish-dataset-row";
import { StandardFieldsSheet } from "./standard-fields-sheet";
import { StandardsStepList } from "./standards-step-list";
import { useFollowedStandards } from "./use-followed-standards";

interface OpenFields {
  standard: StandardId;
  first?: StepReasonCode;
}

interface StandardsStepsBlockProps {
  experimentId: string;
  /** An experiment's admins and members publish, unless it is archived. */
  canPublish: boolean;
}

/**
 * The top of the Datasets tab: what the experiment follows, the ranked steps before a dataset can
 * freeze, and Publish a dataset as the list's last row.
 */
export function StandardsStepsBlock({ experimentId, canPublish }: StandardsStepsBlockProps) {
  const { t } = useTranslation("standards");
  const { followed, isLoading, isError, refetch } = useFollowedStandards(experimentId);
  const { data: access } = useExperimentAccess(experimentId);
  const { data: datasets } = useExperimentDatasets(experimentId);
  const [isChoosing, setIsChoosing] = useState(false);
  const [openFields, setOpenFields] = useState<OpenFields | null>(null);

  const isArchived = access?.experiment.status === "archived";
  const canChange = Boolean(access?.isAdmin) && !isArchived;
  const canFix = Boolean(access?.hasAccess) && !isArchived;
  const draft = datasets?.find((dataset) => dataset.state === "draft");

  const openChooser = () => setIsChoosing(true);
  const closeChooser = () => setIsChoosing(false);
  const closeFields = () => setOpenFields(null);
  const openStandard = (standard: StandardId) => setOpenFields({ standard });
  const openStep = (standard: StandardId, first: StepReasonCode) =>
    setOpenFields({ standard, first });

  const handleRetry = () => {
    void refetch();
  };

  if (isLoading) {
    return <Skeleton className="h-72 w-full" />;
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
  const hasRows = steps.length > 0 || canPublish;

  const stepsLeftFor = (standard: StandardId) =>
    steps.filter((step) => step.holdsFreeze && step.standards.includes(standard)).length;

  const renderStandard = (readiness: StandardReadiness) => (
    <FollowedStandardCard
      key={readiness.standard}
      readiness={readiness}
      stepsLeft={stepsLeftFor(readiness.standard)}
      onOpen={openStandard}
    />
  );

  return (
    <section className="space-y-3" data-testid="standards-steps">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{t("follows.title")}</h3>
        {canChange ? (
          <Button variant="link" className="h-auto shrink-0 p-0" onClick={openChooser}>
            {t("follows.change")}
          </Button>
        ) : null}
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">{followed.followed.map(renderStandard)}</ul>

      <Card padding="none" className="overflow-hidden shadow-none">
        <CardContent className="p-0">
          {hasRows ? (
            <StandardsStepList
              experimentId={experimentId}
              steps={steps}
              canFix={canFix}
              onOpenFields={openStep}
            >
              {canPublish ? (
                <PublishDatasetRow experimentId={experimentId} draft={draft} holding={holding} />
              ) : null}
            </StandardsStepList>
          ) : (
            <p className="text-muted-foreground px-4 py-3 text-sm">{t("publish.ready")}</p>
          )}
        </CardContent>
      </Card>

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
    </section>
  );
}
