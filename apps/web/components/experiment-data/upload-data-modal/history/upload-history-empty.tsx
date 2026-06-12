"use client";

import { Upload } from "lucide-react";

import { useTranslation } from "@repo/i18n/client";

export function UploadHistoryEmpty() {
  const { t } = useTranslation("experimentData");

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-gray-50 py-8 dark:bg-gray-900">
      <div className="bg-muted mb-3 flex h-16 w-16 items-center justify-center rounded-full">
        <Upload className="text-muted-foreground h-8 w-8" />
      </div>
      <p className="text-muted-foreground text-center text-sm">
        {t("experimentData.uploadDataModal.history.empty")}
      </p>
    </div>
  );
}
