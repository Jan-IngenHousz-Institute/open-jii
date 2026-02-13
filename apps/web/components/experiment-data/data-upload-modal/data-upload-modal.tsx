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
import { FileUploadStep } from "./steps/file-upload-step";
import { MetadataUploadStep } from "./steps/metadata-upload-step";
import { SuccessStep } from "./steps/success-step";

type UploadStep = "selection" | "file-upload" | "metadata-upload" | "success";

interface DataUploadModalProps {
  experimentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataUploadModal({ experimentId, open, onOpenChange }: DataUploadModalProps) {
  const { t } = useTranslation("experiments");
  const [step, setStep] = React.useState<UploadStep>("selection");
  const [selectedOption, setSelectedOption] = React.useState<DataOption | null>(null);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setStep("selection");
        setSelectedOption(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

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
    setStep("selection");
  };

  const handleUploadSuccess = () => {
    setStep("success");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{t("uploadModal.title")}</DialogTitle>
          <DialogDescription>{t("uploadModal.description")}</DialogDescription>
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
