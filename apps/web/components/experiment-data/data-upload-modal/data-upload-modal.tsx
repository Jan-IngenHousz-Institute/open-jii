"use client";

import * as React from "react";

import { useTranslation } from "@repo/i18n/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";

import { FileUploadStep } from "./steps/file-upload-step";
import { SuccessStep } from "./steps/success-step";

type UploadStep = "file-upload" | "success";

interface DataUploadModalProps {
  experimentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataUploadModal({ experimentId, open, onOpenChange }: DataUploadModalProps) {
  const { t } = useTranslation("experiments");
  const [step, setStep] = React.useState<UploadStep>("file-upload");

  const prevOpenRef = React.useRef(false);
  if (open && !prevOpenRef.current) {
    setStep("file-upload");
  }
  prevOpenRef.current = open;

  const header =
    step === "success"
      ? {
          title: t("uploadModal.success.title"),
          description: t("uploadModal.success.description"),
        }
      : {
          title: t("uploadModal.fileUpload.title"),
          description: t("uploadModal.fileUpload.description"),
        };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{header.title}</DialogTitle>
          <DialogDescription>{header.description}</DialogDescription>
        </DialogHeader>

        {step === "file-upload" && (
          <FileUploadStep
            experimentId={experimentId}
            onBack={() => onOpenChange(false)}
            onUploadSuccess={() => setStep("success")}
          />
        )}

        {step === "success" && (
          <SuccessStep onClose={() => onOpenChange(false)} isMetadata={false} />
        )}
      </DialogContent>
    </Dialog>
  );
}
