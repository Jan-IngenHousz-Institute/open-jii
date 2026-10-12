"use client";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface ClearFiltersButtonProps {
  active: boolean;
  onClear: () => void;
}

export function ClearFiltersButton({ active, onClear }: ClearFiltersButtonProps) {
  const { t } = useTranslation();

  if (!active) {
    return null;
  }

  return (
    <Button variant="outline" size="sm" onClick={onClear}>
      {t("common.clearFilters")}
    </Button>
  );
}
