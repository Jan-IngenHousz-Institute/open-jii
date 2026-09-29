"use client";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface ResetSortingButtonProps {
  active: boolean;
  onReset: () => void;
}

export function ResetSortingButton({ active, onReset }: ResetSortingButtonProps) {
  const { t } = useTranslation();

  if (!active) {
    return null;
  }

  return (
    <Button variant="outline" size="sm" onClick={onReset}>
      {t("common.resetSorting")}
    </Button>
  );
}
