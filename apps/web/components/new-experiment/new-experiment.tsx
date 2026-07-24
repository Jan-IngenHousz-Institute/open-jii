"use client";

import { StructuralIssueList } from "@/components/workbook/structural-issue-list";
import { useAttachWorkbook } from "@/hooks/experiment/useAttachWorkbook/useAttachWorkbook";
import { useExperimentCreate } from "@/hooks/experiment/useExperimentCreate/useExperimentCreate";
import { useLocale } from "@/hooks/useLocale";
import { parseStructuralValidationError } from "@/lib/workbook/publish-error";
import type { StructuralIssue } from "@/lib/workbook/publish-error";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useRef } from "react";

import type { CreateExperimentBody } from "@repo/api/domains/experiment/experiment.schema";
import { zExperimentVisibility } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { WizardForm } from "@repo/ui/components/wizard-form";
import type { WizardStep, WizardStepProps } from "@repo/ui/components/wizard-form";
import { toast } from "@repo/ui/hooks/use-toast";

import { NewExperimentDetailsCard } from "./new-experiment-details-card";
import { NewExperimentLocationsCard } from "./new-experiment-locations-card";
import { NewExperimentMembersCard } from "./new-experiment-members-card";
import { NewExperimentVisibilityCard } from "./new-experiment-visibility-card";
import {
  detailsSchema,
  FormStep,
  locationsSchema,
  membersVisibilitySchema,
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
  // Durable result when the experiment was created but its selected workbook was
  // structurally rejected: we stay here (never navigate into a contextless empty
  // state) so the author keeps the command-level repair context and both links.
  const [attachFailure, setAttachFailure] = useState<{
    experimentId: string;
    workbookId: string;
    issues: StructuralIssue[];
  } | null>(null);

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

  const pendingWorkbookId = useRef<string | undefined>(undefined);
  const attachWorkbook = useAttachWorkbook();

  const { mutate: createExperiment, isPending } = useExperimentCreate({
    onSuccess: (experimentId: string) => {
      const experimentUrl = `/${locale}/platform/experiments/${experimentId}`;
      const workbookId = pendingWorkbookId.current;
      if (!workbookId) {
        setIsSubmitting(true);
        toast({ description: t("experiments.experimentCreated") });
        router.push(experimentUrl);
        return;
      }
      // Attachment is a separate outcome from creation: success and failure are
      // reported independently (never via onSettled), so a rejected attach is
      // never announced or navigated to as if the workbook were attached.
      attachWorkbook.mutate(
        { id: experimentId, workbookId },
        {
          onSuccess: () => {
            setIsSubmitting(true);
            toast({ description: t("experiments.experimentCreated") });
            router.push(experimentUrl);
          },
          onError: (error) => {
            setIsSubmitting(true);
            // The experiment exists but the workbook did not attach. A structural
            // rejection is repairable, so keep the command-level context here
            // (issues + workbook link + a link to the created experiment) instead
            // of a contextless navigate-away. Other failures stay a toast + go.
            const structural = parseStructuralValidationError(error);
            if (structural) {
              setAttachFailure({ experimentId, workbookId, issues: structural });
              return;
            }
            toast({
              description: t("experiments.experimentCreatedAttachFailed"),
              variant: "destructive",
            });
            router.push(experimentUrl);
          },
        },
      );
    },
  });

  function onSubmit(data: CreateExperimentBody) {
    setIsSubmitting(true);
    pendingWorkbookId.current = data.workbookId ?? undefined;
    createExperiment(data);
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

  // Durable creation result: experiment created, workbook rejected for structural
  // reasons. Keep the repair context (issues keyed by command + workbook link)
  // and offer a link to the created, still-unattached experiment.
  if (attachFailure) {
    return (
      <div className="space-y-4" data-testid="experiment-created-unattached">
        <div>
          <h2 className="text-lg font-medium">
            {t("experiments.experimentCreatedUnattachedTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("experiments.experimentCreatedUnattachedBody")}
          </p>
        </div>
        <StructuralIssueList
          issues={attachFailure.issues}
          workbookId={attachFailure.workbookId}
          locale={locale}
        />
        <NextLink
          href={`/${locale}/platform/experiments/${attachFailure.experimentId}`}
          className="inline-block text-sm font-medium underline"
        >
          {t("experiments.openCreatedExperiment")}
        </NextLink>
      </div>
    );
  }

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
