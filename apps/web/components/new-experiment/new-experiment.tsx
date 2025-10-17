"use client";

import { useExperimentCreate } from "@/hooks/experiment/useExperimentCreate/useExperimentCreate";
import { useLocale } from "@/hooks/useLocale";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as z from "zod";

import type { CreateExperimentBody } from "@repo/api";
import { zExperimentVisibility, zCreateExperimentBodyBase, validateEmbargoDate } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  WizardForm,
} from "@repo/ui/components";
import type { WizardStep } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { DetailsStep } from "./steps/details-step";
import { LocationsStep } from "./steps/locations-step";
import { MembersVisibilityStep } from "./steps/members-visibility-step";
import { ProtocolsStep } from "./steps/protocols-step";
import { ReviewStep } from "./steps/review-step";

export function NewExperimentForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocale();
  const [hasFormData, setHasFormData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const detailsSchema = zCreateExperimentBodyBase.pick({ name: true, description: true });

  const membersVisibilityBase = zCreateExperimentBodyBase.pick({
    members: true,
    visibility: true,
    embargoUntil: true,
  });

  const shape = membersVisibilityBase.shape;

  const membersVisibilitySchema = z.object({
    ...shape,
    embargoUntil: shape.embargoUntil.refine(
      (value) => {
        // Create a dummy refinement context and capture whether issues were added
        let hasIssue = false;
        validateEmbargoDate(
          value,
          {
            addIssue: () => {
              hasIssue = true;
            },
          } as unknown as z.RefinementCtx,
          ["embargoUntil"],
        );
        return !hasIssue;
      },
      {
        message: "Embargo end date must be between tomorrow and 365 days from now",
      },
    ),
  });
  const protocolsLocationsSchema = zCreateExperimentBodyBase.pick({ protocols: true });

  const locationsSchema = zCreateExperimentBodyBase.pick({ locations: true });

  // For the final review step validate the combined schema of all previous steps
  const reviewSchema = z.object({
    ...detailsSchema.shape,
    ...membersVisibilitySchema.shape,
    ...protocolsLocationsSchema.shape,
    ...locationsSchema.shape,
  });

  // Wizard steps use translation strings so define them inside the component
  const steps: WizardStep<CreateExperimentBody>[] = [
    {
      title: t("experiments.detailsTitle"),
      description: t("experiments.detailsDescription"),
      validationSchema: detailsSchema,
      component: DetailsStep,
    },
    {
      title: t("experiments.membersVisibilityTitle"),
      description: t("experiments.membersVisibilityDescription"),
      validationSchema: membersVisibilitySchema,
      component: MembersVisibilityStep,
    },
    {
      title: t("experiments.protocolsTitle"),
      description: t("experiments.protocolsDescription"),
      validationSchema: protocolsLocationsSchema,
      component: ProtocolsStep,
    },
    {
      title: t("experiments.locationsTitle"),
      description: t("experiments.locationsDescription"),
      validationSchema: locationsSchema,
      component: LocationsStep,
    },
    {
      title: t("experiments.reviewTitle"),
      description: t("experiments.reviewDescription"),
      validationSchema: reviewSchema,
      component: ReviewStep,
    },
  ];

  // Use the unsaved changes warning hook
  const { showDialog, dialogMessage, handleConfirmNavigation, handleCancelNavigation } =
    useUnsavedChangesWarning({
      hasUnsavedChanges: hasFormData && !isSubmitting,
      message: t("experiments.unsavedChangesMessage"),
    });

  const { mutate: createExperiment, isPending } = useExperimentCreate({
    onSuccess: (experimentId: string) => {
      setIsSubmitting(true); // Mark as submitted to prevent dialog
      toast({ description: t("experiments.experimentCreated") });
      router.push(`/${locale}/platform/experiments/${experimentId}`);
    },
  });

  function onSubmit(data: CreateExperimentBody) {
    setIsSubmitting(true);
    createExperiment({
      body: data,
    });
  }

  // Track if user has entered any data
  const handleFormChange = () => {
    if (!hasFormData) {
      setHasFormData(true);
    }
  };

  return (
    <>
      <div onChange={handleFormChange} onInput={handleFormChange}>
        <WizardForm<CreateExperimentBody>
          steps={steps}
          defaultValues={{
            name: "",
            description: "",
            visibility: zExperimentVisibility.enum.public,
            members: [],
            locations: [],
          }}
          onSubmit={onSubmit}
          isSubmitting={isPending}
          showStepIndicator={true}
          showStepTitles={true}
        />
      </div>

      <Dialog open={showDialog} onOpenChange={handleCancelNavigation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("experiments.unsavedChangesTitle")}</DialogTitle>
            <DialogDescription>{dialogMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelNavigation}>
              {t("experiments.unsavedStay")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmNavigation}>
              {t("experiments.unsavedLeave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
