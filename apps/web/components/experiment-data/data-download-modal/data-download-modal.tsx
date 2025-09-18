"use client";

import { Download } from "lucide-react";
import * as React from "react";

import { useTranslation } from "@repo/i18n/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components";

import { DownloadLinksStep } from "./steps/download-links-step";
import { FormatSelectionStep } from "./steps/format-selection-step";

// Define types
type DownloadStep = "format-selection" | "download-links";

interface DataDownloadModalProps {
  experimentId: string;
  tableName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataDownloadModal({
  experimentId,
  tableName,
  open,
  onOpenChange,
}: DataDownloadModalProps) {
  const { t } = useTranslation("experimentData");
  const [step, setStep] = React.useState<DownloadStep>("format-selection");

  const handleFormatSubmit = (_format: string) => {
    setStep("download-links");
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setStep("format-selection");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t("experimentData.downloadModal.title")}
          </DialogTitle>
          <DialogDescription>
            {t("experimentData.downloadModal.description", { tableName })}
          </DialogDescription>
        </DialogHeader>

        {step === "format-selection" && (
          <FormatSelectionStep onFormatSubmit={handleFormatSubmit} onClose={handleClose} />
        )}

        {step === "download-links" && (
          <DownloadLinksStep
            experimentId={experimentId}
            tableName={tableName}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
