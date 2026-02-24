"use client";

import * as React from "react";

import { useTranslation } from "@repo/i18n/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components";

import { DataSelectionStep } from "./steps/data-selection-step";
import type { DataOption } from "./steps/data-selection-step";
import { DATA_OPTIONS } from "./steps/data-selection-step";
import { FileUploadStep } from "./steps/file-upload-step";
import { MetadataUploadStep } from "./steps/metadata-upload-step";
import { SuccessStep } from "./steps/success-step";

export type UploadStep = "selection" | "file-upload" | "metadata-upload" | "success";

interface DataUploadModalProps {
  experimentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep?: UploadStep;
}

export function DataUploadModal({ experimentId, open, onOpenChange, initialStep = "selection" }: DataUploadModalProps) {
  const { t } = useTranslation("experiments");
  const [step, setStep] = React.useState<UploadStep>(initialStep);
  const [selectedOption, setSelectedOption] = React.useState<DataOption | null>(null);

  // Sync step with initialStep when modal opens
  React.useEffect(() => {
    if (open) {
      setStep(initialStep);
      if (initialStep === "metadata-upload") {
        setSelectedOption(DATA_OPTIONS.find((o) => o.id === "metadata") ?? null);
      } else if (initialStep === "file-upload") {
        setSelectedOption(DATA_OPTIONS.find((o) => o.id === "ambyte") ?? null);
      }
    }
  }, [open, initialStep]);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setStep(initialStep);
        setSelectedOption(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, initialStep]);

  const handleOptionSelect = (option: DataOption) => {
    setSelectedOption(option);
    if (option.id === "metadata") {
      setStep("metadata-upload");
    } else {
      setStep("file-upload");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleBack = () => {
    if (initialStep === "selection") {
      setStep("selection");
    } else {
      onOpenChange(false);
    }
  };

  const handleUploadSuccess = () => {
    setStep("success");
  };

  const getHeaderContent = () => {
    switch (step) {
      case "file-upload":
        return {
          title: t("uploadModal.fileUpload.title"),
          description: t("uploadModal.fileUpload.description"),
        };
      case "metadata-upload":
        return {
          title: t("uploadModal.metadata.title"),
          description: t("uploadModal.metadata.description"),
        };
      default:
        return {
          title: t("uploadModal.title"),
          description: t("uploadModal.description"),
        };
    }
  };

  const header = getHeaderContent();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{header.title}</DialogTitle>
          <DialogDescription>{header.description}</DialogDescription>
        </DialogHeader>

        {step === "selection" && (
          <DataSelectionStep
            selectedOption={selectedOption}
            onOptionSelect={handleOptionSelect}
          />
        )}

        {step === "file-upload" && (
          <FileUploadStep
            experimentId={experimentId}
            onBack={handleBack}
            onUploadSuccess={handleUploadSuccess}
          />
        )}

        {step === "metadata-upload" && (
          <MetadataUploadStep
            experimentId={experimentId}
            onBack={handleBack}
            onUploadSuccess={handleUploadSuccess}
          />
        )}

        {step === "success" && (
          <SuccessStep
            onClose={handleClose}
            isMetadata={selectedOption?.id === "metadata"}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
