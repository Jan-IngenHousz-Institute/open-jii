"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { ExperimentVisibility } from "@repo/api";
import { visibilitySchema } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentUpdate } from "../../hooks/experiment/useExperimentUpdate/useExperimentUpdate";
import { localCalendarDateToIsoEndOfDay } from "../new-experiment/embargo-utils";
import { ExperimentVisibilityForm } from "./experiment-visibility-form";

interface ExperimentVisibilityCardProps {
  experimentId: string;
  initialVisibility: ExperimentVisibility;
  embargoUntil: string;
  isArchived?: boolean;
}

export function ExperimentVisibilityCard({
  experimentId,
  initialVisibility,
  embargoUntil,
  isArchived = false,
}: ExperimentVisibilityCardProps) {
  const { mutateAsync: updateExperiment, isPending: isUpdating } = useExperimentUpdate();
  const { t } = useTranslation();
  const [currentVisibility, setCurrentVisibility] =
    useState<ExperimentVisibility>(initialVisibility);
  const [showVisibilityDialog, setShowVisibilityDialog] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState<ExperimentVisibility | undefined>();

  interface VisibilityFormValues {
    visibility?: ExperimentVisibility;
    embargoUntil?: string;
  }

  const form = useForm<VisibilityFormValues>({
    resolver: zodResolver(visibilitySchema),
    defaultValues: {
      visibility: initialVisibility,
      embargoUntil,
    },
  });

  const handleVisibilityChange = (newVisibility: ExperimentVisibility) => {
    setPendingVisibility(newVisibility);
    setShowVisibilityDialog(true);
  };

  const handleEmbargoDateSelect = async (date?: Date) => {
    const iso = localCalendarDateToIsoEndOfDay(date);
    form.setValue("embargoUntil", iso ?? "");

    const isValid = await form.trigger("embargoUntil");
    //block updates if Zod fails
    if (!isValid) return;

    const currentVisibilityValue = form.getValues("visibility");
    if (!currentVisibilityValue) return;

    await updateExperiment({
      params: { id: experimentId },
      body: {
        visibility: currentVisibilityValue,
        embargoUntil: iso ?? "",
      },
    });

    toast({ description: t("experiments.experimentUpdated") });
  };

  const confirmVisibilityChange = async () => {
    if (pendingVisibility === undefined) return;

    const currentEmbargoUntil = form.getValues("embargoUntil");
    const updateData = {
      visibility: pendingVisibility,
      ...(pendingVisibility === "private" && {
        embargoUntil: currentEmbargoUntil,
      }),
    };

    await updateExperiment({
      params: { id: experimentId },
      body: updateData,
    });

    form.setValue("visibility", pendingVisibility);
    toast({ description: t("experiments.experimentUpdated") });

    // If visibility was changed to public, update local state so UI disables private
    if (pendingVisibility === "public") {
      setCurrentVisibility("public");
    }

    setShowVisibilityDialog(false);
    setPendingVisibility(undefined);
  };

  return (
    <>
      <CardHeader>
        <CardTitle>{t("experimentVisibility.visibilityCardTitle")}</CardTitle>
        <CardDescription>{t("experimentVisibility.visibilityCardDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ExperimentVisibilityForm
          form={form}
          currentVisibility={currentVisibility}
          isArchived={isArchived}
          onVisibilityChange={handleVisibilityChange}
          onEmbargoDateSelect={handleEmbargoDateSelect}
        />

        {/* Visibility Change Confirmation Dialog */}
        <Dialog open={showVisibilityDialog} onOpenChange={setShowVisibilityDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {pendingVisibility === "public"
                  ? t("experimentVisibility.changeToPublicTitle")
                  : t("experimentVisibility.changeToPrivateTitle")}
              </DialogTitle>
              <DialogDescription>
                {pendingVisibility === "public"
                  ? t("experimentVisibility.changeToPublicDescription")
                  : t("experimentVisibility.changeToPrivateDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowVisibilityDialog(false)}
                disabled={isUpdating}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={confirmVisibilityChange} disabled={isUpdating}>
                {isUpdating ? t("experimentSettings.saving") : t("common.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </>
  );
}
