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
import { toast } from "@repo/ui/hooks";

import { ExportListStep } from "./steps/export-list-step";

interface DataExportModalProps {
  experimentId: string;
  tableName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type CreationStatus = "idle" | "creating" | "success";

export function DataExportModal({
  experimentId,
  tableName,
  open,
  onOpenChange,
}: DataExportModalProps) {
  const { t } = useTranslation("experimentData");
  const [creationStatus, setCreationStatus] = React.useState<CreationStatus>("idle");

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setCreationStatus("idle");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const { mutate: initiateExport } = useInitiateExport({
    onSuccess: () => {
      setCreationStatus("success");
      toast({ description: t("experimentData.exportModal.creationSuccess") });

      setTimeout(() => {
        setCreationStatus("idle");
      }, 2000);
    },
  });

  const handleCreateExport = (format: string) => {
    setCreationStatus("creating");

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
          setCreationStatus("idle");
          toast({
            description:
              parseApiError(error)?.message ?? t("experimentData.exportModal.creationError"),
            variant: "destructive",
          });
        },
      },
    );
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
            {t("experimentData.exportModal.title")}
          </DialogTitle>
          <DialogDescription>
            {t("experimentData.exportModal.description", { tableName })}
          </DialogDescription>
        </DialogHeader>

        <ExportListStep
          experimentId={experimentId}
          tableName={tableName}
          onCreateExport={handleCreateExport}
          onClose={handleClose}
          creationStatus={creationStatus}
        />
      </DialogContent>
    </Dialog>
  );
}
