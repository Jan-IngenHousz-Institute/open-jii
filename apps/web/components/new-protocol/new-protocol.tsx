"use client";

import { useAddCompatibleMacro } from "@/hooks/protocol/useAddCompatibleMacro/useAddCompatibleMacro";
import { useProtocolCreate } from "@/hooks/protocol/useProtocolCreate/useProtocolCreate";
import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";

import type { CreateProtocolRequestBody, Macro } from "@repo/api";
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

import { IotProtocolRunner } from "../iot/iot-protocol-runner";
import ProtocolCodeEditor from "../protocol-code-editor";
import { NewProtocolDetailsCard } from "./new-protocol-details-card";
import { CodeTestStep, codeSchema } from "./steps/code-test-step";
import { DetailsStep, detailsSchema } from "./steps/details-step";
import { ReviewStep, reviewSchema } from "./steps/review-step";

export function NewProtocolForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocale();
  const browserSupport = useIotBrowserSupport();

  const isCodeValidRef = useRef(true);
  const [hasFormData, setHasFormData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Selected macros (local state before protocol creation)
  const [selectedMacros, setSelectedMacros] = useState<Macro[]>([]);

  const addMacrosMutationRef = useRef<ReturnType<typeof useAddCompatibleMacro>>(null);

  const { mutate: createProtocol, isPending } = useProtocolCreate({
    onSettled: () => {
      setIsSubmitting(false);
    },
    onSuccess: (data) => {
      const id = data.body.id;
      // Link selected macros after protocol creation, then redirect
      if (selectedMacros.length > 0 && addMacrosMutationRef.current) {
        addMacrosMutationRef.current
          .mutateAsync({
            params: { id },
            body: { macroIds: selectedMacros.map((m) => m.id) },
          })
          .catch(() => {
            // Protocol created successfully, macro linking failed - still redirect
          })
          .finally(() => {
            router.push(`/${locale}/platform/protocols/${id}`);
          });
        return;
      }
      router.push(`/${locale}/platform/protocols/${id}`);
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
    const DetailsCardWithMacros = ({
      form,
    }: {
      form: UseFormReturn<CreateProtocolRequestBody>;
    }) => (
      <NewProtocolDetailsCard
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

    const Component = (props: WizardStepProps<CreateProtocolRequestBody>) => {
      return <DetailsStep {...props} cards={[DetailsCardWithMacros]} />;
    };
    return Component;
  };

  // Helper to create CodeTestStep with IoT props
  const createCodeTestStep = () => {
    const Component = (props: WizardStepProps<CreateProtocolRequestBody>) => (
      <CodeTestStep
        {...props}
        browserSupport={browserSupport}
        setIsCodeValid={(v: boolean) => {
          isCodeValidRef.current = v;
        }}
        ProtocolCodeEditor={ProtocolCodeEditor}
        IotProtocolRunner={IotProtocolRunner}
      />
    );
    return Component;
  };

  // Helper to create ReviewStep with macros
  const createReviewStep = () => {
    const Component = (props: WizardStepProps<CreateProtocolRequestBody>) => (
      <ReviewStep {...props} selectedMacros={selectedMacros} />
    );
    return Component;
  };

  const steps: WizardStep<CreateProtocolRequestBody>[] = useMemo(
    () => [
      {
        title: t("newProtocol.detailsStepTitle"),
        description: t("newProtocol.detailsStepDescription"),
        validationSchema: detailsSchema,
        component: createDetailsStep(),
      },
      {
        title: t("newProtocol.codeStepTitle"),
        description: t("newProtocol.codeStepDescription"),
        validationSchema: codeSchema,
        component: createCodeTestStep(),
      },
      {
        title: t("newProtocol.reviewStepTitle"),
        description: t("newProtocol.reviewStepDescription"),
        validationSchema: reviewSchema,
        component: createReviewStep(),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, browserSupport, selectedMacros],
  );

  function onSubmit(data: CreateProtocolRequestBody) {
    setIsSubmitting(true);
    createProtocol({
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
        <WizardForm<CreateProtocolRequestBody>
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
            <DialogTitle>{t("newProtocol.unsavedChangesTitle")}</DialogTitle>
            <DialogDescription>{t("newProtocol.unsavedChangesMessage")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelNavigation}>
              {t("newProtocol.unsavedStay")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmNavigation}>
              {t("newProtocol.unsavedLeave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
