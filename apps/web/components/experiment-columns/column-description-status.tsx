"use client";

import { Check } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

interface ColumnDescriptionStatusProps {
  isDescribed: boolean;
}

export function ColumnDescriptionStatus({ isDescribed }: ColumnDescriptionStatusProps) {
  const { t } = useTranslation("studyMetadata");

  if (isDescribed) {
    return (
      <Badge variant="secondary">
        <Check />
        {t("dictionary.described")}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-muted-foreground">
      {t("dictionary.notDescribed")}
    </Badge>
  );
}
