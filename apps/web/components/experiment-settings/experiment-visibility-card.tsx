"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
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
 * Experiment visibility settings, reworked to the one-way publish flow:
 * - while **private**: an embargo date editor plus an explicit, irreversible
 *   "Publish" action (confirmed via dialog) that calls the dedicated
 *   `setVisibility` route;
 * - once **public**: a static state with no controls — visibility can never be
 *   made private again.
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
  // Track a local publish so the static state shows immediately on confirm,
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
        <div className="space-y-2">
          <div className="text-sm font-medium">{t("experimentVisibility.statusLabel")}</div>
          <div className="text-muted-foreground text-sm">
            {isPublic
              ? t("experimentVisibility.publicStatus")
              : t("experimentVisibility.privateStatus")}
          </div>
        </div>

        {isPublic ? (
          <div className="bg-surface-light text-muted-foreground flex items-center gap-2 rounded-md p-2 text-xs">
            <Info className="text-primary h-4 w-4" />
            <div className="leading-tight">{t("experimentVisibility.publishedDescription")}</div>
          </div>
        ) : (
          <>
            <ExperimentVisibilityForm
              form={form}
              isArchived={isArchived}
              onEmbargoDateSelect={handleEmbargoDateSelect}
            />
            <Button
              onClick={() => setShowPublishDialog(true)}
              disabled={isArchived || isPublishing}
            >
              {t("experimentVisibility.publishAction")}
            </Button>
          </>
        )}

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
