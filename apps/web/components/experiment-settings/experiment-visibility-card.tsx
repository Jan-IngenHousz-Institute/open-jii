"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
  initialVisibility: "private" | "public";
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
  const [currentVisibility, setCurrentVisibility] = useState<"private" | "public">(
    initialVisibility,
  );
  const [showVisibilityDialog, setShowVisibilityDialog] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState<"private" | "public" | undefined>();

  interface VisibilityFormValues {
    visibility?: "private" | "public";
    embargoUntil?: string;
  }

  const form = useForm<VisibilityFormValues>({
    resolver: zodResolver(visibilitySchema),
    defaultValues: {
      visibility: initialVisibility,
      embargoUntil,
    },
  });

  const handleVisibilityChange = (newVisibility: "private" | "public") => {
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
        <CardTitle>Actions</CardTitle>
        <CardDescription>
          Set the page to public or private to control who can see it.
        </CardDescription>
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
                {pendingVisibility === "public" ? "Change to Public?" : "Change to Private?"}
              </DialogTitle>
              <DialogDescription>
                {pendingVisibility === "public"
                  ? "Making this experiment public will allow anyone to view it. This action cannot be undone."
                  : "Making this experiment private will restrict access to only members."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowVisibilityDialog(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button onClick={confirmVisibilityChange} disabled={isUpdating}>
                {isUpdating ? t("experimentSettings.saving") : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </>
  );
}
