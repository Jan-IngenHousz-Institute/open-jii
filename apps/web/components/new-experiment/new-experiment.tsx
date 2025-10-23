"use client";

import { useExperimentCreate } from "@/hooks/experiment/useExperimentCreate/useExperimentCreate";
import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";

import type { CreateExperimentBody } from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
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
import type { WizardStep, WizardStepProps } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { NewExperimentDetailsCard } from "./new-experiment-details-card";
import { NewExperimentLocationsCard } from "./new-experiment-locations-card";
import { NewExperimentMembersCard } from "./new-experiment-members-card";
import { NewExperimentProtocolsCard } from "./new-experiment-protocols-card";
import { NewExperimentVisibilityCard } from "./new-experiment-visibility-card";
import {
  detailsSchema,
  FormStep,
  locationsSchema,
  membersVisibilitySchema,
  protocolsSchema,
} from "./steps/form-step";
import { ReviewStep, reviewSchema } from "./steps/review-step/review-step";

export function NewExperimentForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocale();
  const [hasFormData, setHasFormData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Helper to create FormStep with specific cards
  const createFormStep = (cards: Parameters<typeof FormStep>[0]["cards"]) => {
    const Component = (props: WizardStepProps<CreateExperimentBody>) => (
      <FormStep {...props} cards={cards} />
    );
    return Component;
  };

  // Wizard steps
  const steps: WizardStep<CreateExperimentBody>[] = useMemo(
    () => [
      {
        title: t("experiments.detailsTitle"),
        description: t("experiments.detailsDescription"),
        validationSchema: detailsSchema,
        component: createFormStep([NewExperimentDetailsCard]),
      },
      {
        title: t("experiments.membersVisibilityTitle"),
        description: t("experiments.membersVisibilityDescription"),
        validationSchema: membersVisibilitySchema,
        component: createFormStep([NewExperimentMembersCard, NewExperimentVisibilityCard]),
      },
      {
        title: t("experiments.protocolsTitle"),
        description: t("experiments.protocolsDescription"),
        validationSchema: protocolsSchema,
        component: createFormStep([NewExperimentProtocolsCard]),
      },
      {
        title: t("experiments.locationsTitle"),
        description: t("experiments.locationsDescription"),
        validationSchema: locationsSchema,
        component: createFormStep([NewExperimentLocationsCard]),
      },
      {
        title: t("experiments.reviewTitle"),
        description: t("experiments.reviewDescription"),
        validationSchema: reviewSchema,
        component: ReviewStep,
      },
    ],
    [t],
  );

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

  // Block navigation when there are unsaved changes
  useEffect(() => {
    if (!hasFormData || isSubmitting) return;

    // Intercept internal Next.js link clicks
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (link?.href && !link.target && link.origin === window.location.origin) {
        e.preventDefault();
        e.stopPropagation();

        setPendingNavigation(() => () => {
          window.location.href = link.href;
        });
        setShowDialog(true);
      }
    };

    // Warn only on tab close or page refresh
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (showDialog) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleLinkClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [hasFormData, isSubmitting, showDialog]);

  const handleCancelNavigation = () => {
    setShowDialog(false);
    setPendingNavigation(null);
  };

  const handleConfirmNavigation = () => {
    setShowDialog(false);
    if (pendingNavigation) {
      pendingNavigation();
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
            <DialogDescription>{t("experiments.unsavedChangesMessage")}</DialogDescription>
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
