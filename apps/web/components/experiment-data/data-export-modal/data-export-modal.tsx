"use client";

import { Download } from "lucide-react";
import * as React from "react";
import { useInitiateExport } from "~/hooks/experiment/useInitiateExport/useInitiateExport";
import { parseApiError } from "~/util/apiError";

import { useTranslation } from "@repo/i18n/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components";

import { ExportCreationStep } from "./steps/export-creation-step";
import { ExportListStep } from "./steps/export-list-step";

interface DataExportModalProps {
  experimentId: string;
  tableName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ModalStep = "list" | "creating";

export function DataExportModal({
  experimentId,
  tableName,
  open,
  onOpenChange,
}: DataExportModalProps) {
  const { t } = useTranslation("experimentData");
  const [currentStep, setCurrentStep] = React.useState<ModalStep>("list");
  const [selectedFormat, setSelectedFormat] = React.useState("");
  const [creationStatus, setCreationStatus] = React.useState<"loading" | "success" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = React.useState<string>();

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setCurrentStep("list");
        setSelectedFormat("");
        setCreationStatus("loading");
        setErrorMessage(undefined);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const { mutate: initiateExport } = useInitiateExport({
    onSuccess: () => {
      setCreationStatus("success");
    },
  });

  const handleCreateExport = (format: string) => {
    setSelectedFormat(format);
    setCreationStatus("loading");
    setErrorMessage(undefined);
    setCurrentStep("creating");

    initiateExport(
      {
        params: { id: experimentId },
        body: {
          tableName,
          format: format as "csv" | "ndjson" | "json-array" | "parquet",
        },
      },
      {
        onError: (error) => {
          setCreationStatus("error");
          setErrorMessage(parseApiError(error)?.message);
        },
      },
    );
  };

  const handleBackToList = () => {
    setCurrentStep("list");
    setSelectedFormat("");
    setCreationStatus("loading");
    setErrorMessage(undefined);
  };

  const handleClose = () => {
    onOpenChange(false);
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
            onCreateExport={handleCreateExport}
            onClose={handleClose}
          />
        ) : (
          <ExportCreationStep
            format={selectedFormat}
            status={creationStatus}
            errorMessage={errorMessage}
            onBackToList={handleBackToList}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
