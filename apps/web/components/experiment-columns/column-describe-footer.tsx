"use client";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface ColumnDescribeFooterProps {
  canDescribe: boolean;
  hasNext: boolean;
  isPending: boolean;
  onCancel: () => void;
  onSaveAndNext: () => void;
}

export function ColumnDescribeFooter({
  canDescribe,
  hasNext,
  isPending,
  onCancel,
  onSaveAndNext,
}: ColumnDescribeFooterProps) {
  const { t } = useTranslation("studyMetadata");

  if (!canDescribe) {
    return (
      <div className="border-border flex justify-end border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("describe.close")}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-border flex justify-between gap-2 border-t px-6 py-4">
      <Button type="button" variant="outline" onClick={onCancel}>
        {t("describe.cancel")}
      </Button>
      <div className="flex gap-2">
        {hasNext && (
          <Button type="button" variant="outline" disabled={isPending} onClick={onSaveAndNext}>
            {t("describe.saveAndNext")}
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {t("describe.save")}
        </Button>
      </div>
    </div>
  );
}
