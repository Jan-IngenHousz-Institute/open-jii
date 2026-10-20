"use client";

import { parseApiError } from "~/util/apiError";

import { useTranslation } from "@repo/i18n/client";

export function UploadHistoryError({ error }: { error: Error }) {
  const { t } = useTranslation("experimentData");
  const message =
    parseApiError(error)?.message ?? t("experimentData.uploadDataModal.history.unknownError");

  return (
    <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
      {t("experimentData.uploadDataModal.history.error", { message })}
    </div>
  );
}
