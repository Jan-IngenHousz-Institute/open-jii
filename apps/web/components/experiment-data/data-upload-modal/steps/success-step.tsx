"use client";

import { CheckCircle, Info } from "lucide-react";
import * as React from "react";

import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components";

interface SuccessStepProps {
  onClose: () => void;
  isMetadata?: boolean;
}

export const SuccessStep: React.FC<SuccessStepProps> = ({ onClose, isMetadata = false }) => {
  const { t } = useTranslation("experiments");

  const titleKey = isMetadata ? "uploadModal.success.metadataTitle" : "uploadModal.success.title";
  const descriptionKey = isMetadata
    ? "uploadModal.success.metadataDescription"
    : "uploadModal.success.description";

  return (
    <div className="space-y-4 text-center">
      <div className="flex flex-col items-center">
        <CheckCircle className="mb-4 mt-4 h-10 w-10 text-green-500" />
        <h3 className="text-lg font-medium text-green-700">{t(titleKey)}</h3>
      </div>

      <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <div className="flex">
          <Info className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
          <p>{t(descriptionKey)}</p>
        </div>
      </div>

      <Button onClick={onClose} className="w-full">
        {t("uploadModal.success.close")}
      </Button>
    </div>
  );
};
