"use client";

import * as React from "react";

import { useTranslation } from "@repo/i18n/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";
import { MetadataUploadStep } from "./steps/metadata-upload-step";

interface MetadataUploadModalProps {
  experimentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MetadataUploadModal({
  experimentId,
  open,
  onOpenChange,
}: MetadataUploadModalProps) {
  const { t } = useTranslation("experiments");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{t("uploadModal.metadata.title")}</DialogTitle>
          <DialogDescription>{t("uploadModal.metadata.description")}</DialogDescription>
        </DialogHeader>

        <MetadataUploadStep experimentId={experimentId} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
