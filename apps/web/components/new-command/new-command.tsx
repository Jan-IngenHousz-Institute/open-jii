"use client";

import { useAddCompatibleMacro } from "@/hooks/command/useAddCompatibleMacro/useAddCompatibleMacro";
import { useCommandCreate } from "@/hooks/command/useCommandCreate/useCommandCreate";
import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";

import type { CreateCommandRequestBody } from "@repo/api/schemas/command.schema";
import type { Macro } from "@repo/api/schemas/macro.schema";
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

import CommandCodeEditor from "../command-code-editor";
import { IotCommandRunner } from "../iot/iot-command-runner";
import { NewCommandDetailsCard } from "./new-command-details-card";
import { CodeTestStep, codeSchema } from "./steps/code-test-step";
import { DetailsStep, detailsSchema } from "./steps/details-step";
import { ReviewStep, reviewSchema } from "./steps/review-step";

export function NewCommandForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocale();
  const browserSupport = useIotBrowserSupport();

  const isCodeValidRef = useRef(true);
  const [hasFormData, setHasFormData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Selected macros (local state before command creation)
  const [selectedMacros, setSelectedMacros] = useState<Macro[]>([]);

  const addMacrosMutationRef = useRef<ReturnType<typeof useAddCompatibleMacro>>(null);

  const { mutate: createCommand, isPending } = useCommandCreate({
    onSettled: () => {
      setIsSubmitting(false);
    },
    onSuccess: (data) => {
      const id = data.body.id;
      // Link selected macros after command creation, then redirect
      if (selectedMacros.length > 0 && addMacrosMutationRef.current) {
        addMacrosMutationRef.current
          .mutateAsync({
            params: { id },
            body: { macroIds: selectedMacros.map((m) => m.id) },
          })
          .catch(() => {
            // Command created successfully, macro linking failed - still redirect
          })
          .finally(() => {
            router.push(`/${locale}/platform/commands/${id}`);
          });
        return;
      }
      router.push(`/${locale}/platform/commands/${id}`);
    },
  });

  const addMacrosMutation = useAddCompatibleMacro("");
  addMacrosMutationRef.current = addMacrosMutation;

  const handleRemoveMacro = (macroId: string) => {
    setSelectedMacros((prev) => prev.filter((m) => m.id !== macroId));
    setHasFormData(true);
  };

  // Helper to create DetailsStep with the details card
  const createDetailsStep = () => {
    const DetailsCardWithMacros = ({ form }: { form: UseFormReturn<CreateCommandRequestBody> }) => (
      <NewCommandDetailsCard
        form={form}
        selectedMacros={selectedMacros}
        onAddMacro={(macro: Macro) => {
          setSelectedMacros((prev) => {
            if (prev.some((m) => m.id === macro.id)) return prev;
            setHasFormData(true);
            return [...prev, macro];
          });
        }}
        onRemoveMacro={handleRemoveMacro}
      />
    );

    const Component = (props: WizardStepProps<CreateCommandRequestBody>) => {
      return <DetailsStep {...props} cards={[DetailsCardWithMacros]} />;
    };
    return Component;
  };

  // Helper to create CodeTestStep with IoT props
  const createCodeTestStep = () => {
    const Component = (props: WizardStepProps<CreateCommandRequestBody>) => (
      <CodeTestStep
        {...props}
        browserSupport={browserSupport}
        setIsCodeValid={(v: boolean) => {
          isCodeValidRef.current = v;
        }}
        CommandCodeEditor={CommandCodeEditor}
        IotCommandRunner={IotCommandRunner}
      />
    );
    return Component;
  };

  // Helper to create ReviewStep with macros
  const createReviewStep = () => {
    const Component = (props: WizardStepProps<CreateCommandRequestBody>) => (
      <ReviewStep {...props} selectedMacros={selectedMacros} />
    );
    return Component;
  };

  const steps: WizardStep<CreateCommandRequestBody>[] = useMemo(
    () => [
      {
        title: t("newCommand.detailsStepTitle"),
        description: t("newCommand.detailsStepDescription"),
        validationSchema: detailsSchema,
        component: createDetailsStep(),
      },
      {
        title: t("newCommand.codeStepTitle"),
        description: t("newCommand.codeStepDescription"),
        validationSchema: codeSchema,
        component: createCodeTestStep(),
      },
      {
        title: t("newCommand.reviewStepTitle"),
        description: t("newCommand.reviewStepDescription"),
        validationSchema: reviewSchema,
        component: createReviewStep(),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, browserSupport, selectedMacros],
  );

  function onSubmit(data: CreateCommandRequestBody) {
    setIsSubmitting(true);
    createCommand({
      body: {
        name: data.name,
        description: data.description,
        code: data.code,
        family: data.family,
      },
    });
  }

  const handleFormChange = () => {
    if (!hasFormData) {
      setHasFormData(true);
    }
  };

  useEffect(() => {
    if (!hasFormData || isSubmitting) return;

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (link?.href && !link.target && link.origin === window.location.origin) {
        e.preventDefault();
        e.stopPropagation();
        const pathname = link.pathname + link.search + link.hash;
        setPendingNavigation(() => () => {
          router.push(pathname);
        });
        setShowDialog(true);
      }
    };

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
  }, [hasFormData, isSubmitting, showDialog, router]);

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
        <WizardForm<CreateCommandRequestBody>
          steps={steps}
          defaultValues={{
            name: "",
            description: "",
            code: [{}],
            family: "generic",
          }}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting || isPending}
          showStepIndicator={true}
          showStepTitles={true}
        />
      </div>

      <Dialog open={showDialog} onOpenChange={handleCancelNavigation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newCommand.unsavedChangesTitle")}</DialogTitle>
            <DialogDescription>{t("newCommand.unsavedChangesMessage")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelNavigation}>
              {t("newCommand.unsavedStay")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmNavigation}>
              {t("newCommand.unsavedLeave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
