"use client";

import { Download } from "lucide-react";
import * as React from "react";
import { useInitiateExport } from "~/hooks/experiment/useInitiateExport/useInitiateExport";

import { useTranslation } from "@repo/i18n/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components";

import { ExportListStep } from "./steps/export-list-step";
import { FormatSelectionStep } from "./steps/format-selection-step";

interface DataExportModalProps {
  experimentId: string;
  tableName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ModalStep = "list" | "create";

export function DataExportModal({
  experimentId,
  tableName,
  open,
  onOpenChange,
}: DataExportModalProps) {
  const { t } = useTranslation("experimentData");
  const [currentStep, setCurrentStep] = React.useState<ModalStep>("list");

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      // Reset on close with a slight delay to avoid visual jumps
      const timer = setTimeout(() => {
        setCurrentStep("list");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const { mutate: initiateExport, isPending } = useInitiateExport({
    onSuccess: () => {
      // Navigate back to list after successful creation
      setCurrentStep("list");
    },
  });

  const handleFormatSubmit = (format: string) => {
    initiateExport({
      params: { id: experimentId },
      body: {
        tableName,
        format: format as "csv" | "json" | "parquet",
      },
    });
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleCreateNew = () => {
    setCurrentStep("create");
  };

  const handleBackToList = () => {
    setCurrentStep("list");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {currentStep === "list"
              ? t("experimentData.exportModal.title")
              : t("experimentData.exportModal.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {currentStep === "list"
              ? t("experimentData.exportModal.description", { tableName })
              : t("experimentData.exportModal.createDescription", { tableName })}
          </DialogDescription>
        </DialogHeader>

        {currentStep === "list" ? (
          <ExportListStep
            experimentId={experimentId}
            tableName={tableName}
            onCreateNew={handleCreateNew}
            onClose={handleClose}
          />
        ) : (
          <FormatSelectionStep
            onFormatSubmit={handleFormatSubmit}
            onBack={handleBackToList}
            onClose={handleClose}
            isCreating={isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
