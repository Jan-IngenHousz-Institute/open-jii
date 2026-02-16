"use client";

import { Download } from "lucide-react";
import * as React from "react";
import { useExperimentDataDownload } from "~/hooks/experiment/useExperimentDataDownload/useExperimentDataDownload";

import { useTranslation } from "@repo/i18n/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components";

import { FormatSelectionStep } from "./steps/format-selection-step";

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
  const { mutate: downloadData, isPending } = useExperimentDataDownload();

  const handleFormatSubmit = (format: string) => {
    downloadData(
      {
        experimentId,
        tableName,
        format: format as "csv" | "json" | "parquet",
      },
      {
        onSuccess: () => {
          // Close modal after triggering download
          onOpenChange(false);
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
            {t("experimentData.downloadModal.title")}
          </DialogTitle>
          <DialogDescription>
            {t("experimentData.downloadModal.description", { tableName })}
          </DialogDescription>
        </DialogHeader>

        <FormatSelectionStep
          onFormatSubmit={handleFormatSubmit}
          onClose={handleClose}
          isDownloading={isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
