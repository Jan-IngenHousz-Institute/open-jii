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

import { MetadataUploadStep } from "./steps/metadata-upload-step";

interface MetadataUploadModalProps {
  experimentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens straight on a new sheet with this match target chosen, such as the layout's plots. */
  matchTarget?: string;
}

export function MetadataUploadModal({
  experimentId,
  open,
  onOpenChange,
  matchTarget,
}: MetadataUploadModalProps) {
  const { t } = useTranslation("experiments");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{t("uploadModal.metadata.title")}</DialogTitle>
          <DialogDescription>{t("uploadModal.metadata.description")}</DialogDescription>
        </DialogHeader>

        <MetadataUploadStep
          experimentId={experimentId}
          matchTarget={matchTarget}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
