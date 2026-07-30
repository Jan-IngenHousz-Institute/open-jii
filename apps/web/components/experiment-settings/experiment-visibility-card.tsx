"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { ExperimentVisibility } from "@repo/api/domains/experiment/experiment.schema";
import { embargoSchema } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { toast } from "@repo/ui/hooks/use-toast";

import { useExperimentUpdate } from "../../hooks/experiment/useExperimentUpdate/useExperimentUpdate";
import { useSetExperimentVisibility } from "../../hooks/experiment/useSetExperimentVisibility/useSetExperimentVisibility";
import { localCalendarDateToIsoEndOfDay } from "../new-experiment/embargo-utils";
import { ExperimentAnonymizeToggle } from "./experiment-anonymize-toggle";
import { ExperimentVisibilityForm } from "./experiment-visibility-form";

interface ExperimentVisibilityCardProps {
  experimentId: string;
  initialVisibility: ExperimentVisibility;
  embargoUntil: string;
  initialAnonymize: boolean;
  isArchived?: boolean;
}

interface EmbargoFormValues {
  embargoUntil?: string;
}

/**
 * Experiment visibility settings: the visibility select, and — while private —
 * the embargo date that schedules the automatic transition.
 *
 * Choosing "public" is irreversible, so it is confirmed in a dialog and written
 * through the dedicated `setVisibility` route rather than the general update
 * body, which does not accept `visibility` at all. The select never submits; it
 * reflects the persisted value and goes inert once public.
 */
export function ExperimentVisibilityCard({
  experimentId,
  initialVisibility,
  embargoUntil,
  initialAnonymize,
  isArchived = false,
}: ExperimentVisibilityCardProps) {
  const { mutateAsync: updateExperiment } = useExperimentUpdate();
  const { mutateAsync: setVisibility, isPending: isPublishing } = useSetExperimentVisibility();
  const { t } = useTranslation();
  // Track a local publish so the select reads "Public" immediately on confirm,
  // before the query refetches. Visibility is monotonic (private→public only),
  // so `isPublic` is derived from the prop OR this flag — if the experiment is
  // published elsewhere (embargo cron, another tab) and the query refetches to
  // public, the card follows the prop rather than staying stuck on private.
  const [publishedLocally, setPublishedLocally] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  const form = useForm<EmbargoFormValues>({
    resolver: zodResolver(embargoSchema),
    defaultValues: {
      embargoUntil,
    },
  });

  const isPublic = initialVisibility === "public" || publishedLocally;

  const handleEmbargoDateSelect = async (date?: Date) => {
    const iso = localCalendarDateToIsoEndOfDay(date);
    form.setValue("embargoUntil", iso ?? "");

    // Block the update if the picked date fails validation (Zod).
    const isValid = await form.trigger("embargoUntil");
    if (!isValid) return;

    await updateExperiment({
      id: experimentId,
      embargoUntil: iso ?? "",
    });

    toast({ description: t("experiments.experimentUpdated") });
  };

  // The select is the only way in, and it is disabled once public, so the sole
  // reachable change is private → public — which needs confirming, not writing.
  const handleVisibilityChange = (next: ExperimentVisibility) => {
    if (next === "public") setShowPublishDialog(true);
  };

  const confirmPublish = async () => {
    await setVisibility({ id: experimentId, visibility: "public" });
    setPublishedLocally(true);
    toast({ description: t("experiments.experimentUpdated") });
    setShowPublishDialog(false);
  };

  return (
    <>
      <CardHeader>
        <CardTitle>{t("experimentVisibility.visibilityCardTitle")}</CardTitle>
        <CardDescription>{t("experimentVisibility.visibilityCardDescription")}</CardDescription>
        <DocsHelpLink path="/guide/sharing/visibility-embargo" className="mt-1" />
      </CardHeader>
      <CardContent className="space-y-6">
        <ExperimentVisibilityForm
          form={form}
          currentVisibility={isPublic ? "public" : "private"}
          isArchived={isArchived}
          onVisibilityChange={handleVisibilityChange}
          onEmbargoDateSelect={handleEmbargoDateSelect}
        />

        <ExperimentAnonymizeToggle
          experimentId={experimentId}
          initialAnonymize={initialAnonymize}
          isArchived={isArchived}
        />

        {/* Publish confirmation — irreversible, one-way transition to public. */}
        <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("experimentVisibility.changeToPublicTitle")}</DialogTitle>
              <DialogDescription>
                {t("experimentVisibility.changeToPublicDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowPublishDialog(false)}
                disabled={isPublishing}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={confirmPublish} disabled={isPublishing}>
                {isPublishing
                  ? t("experimentSettings.saving")
                  : t("experimentVisibility.publishConfirmButton")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </>
  );
}
