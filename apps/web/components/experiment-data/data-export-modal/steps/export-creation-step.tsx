"use client";

import { CheckCircle, Loader2, XCircle } from "lucide-react";

import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components";

const FORMAT_LABELS: Record<string, string> = {
  csv: "CSV",
  ndjson: "NDJSON",
  "json-array": "JSON Array",
  parquet: "Parquet",
};

type CreationStatus = "loading" | "success" | "error";

interface ExportCreationStepProps {
  format: string;
  status: CreationStatus;
  errorMessage?: string;
  onBackToList: () => void;
}

export function ExportCreationStep({
  format,
  status,
  errorMessage,
  onBackToList,
}: ExportCreationStepProps) {
  const { t } = useTranslation("experimentData");

  const formatDisplayName = FORMAT_LABELS[format] ?? format.toUpperCase();

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-400">
          <div className="flex gap-3">
            <Loader2 className="mt-0.5 h-5 w-5 flex-shrink-0 animate-spin" />
            <div>
              <p className="font-medium">
                {t("experimentData.exportModal.creatingTitle", {
                  format: formatDisplayName,
                })}
              </p>
              <p className="mt-1 text-blue-700 dark:text-blue-300">
                {t("experimentData.exportModal.creatingDescription", {
                  format: formatDisplayName,
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400">
          <div className="flex gap-3">
            <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">{t("experimentData.exportModal.creationSuccess")}</p>
              <p className="mt-1 text-green-700 dark:text-green-300">
                {t("experimentData.exportModal.creationSuccessDescription")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onBackToList}>{t("experimentData.exportModal.backToList")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
        <div className="flex gap-3">
          <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">{t("experimentData.exportModal.creationError")}</p>
            {errorMessage && <p className="mt-1 text-red-700 dark:text-red-300">{errorMessage}</p>}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onBackToList}>{t("experimentData.exportModal.backToList")}</Button>
      </div>
    </div>
  );
}
