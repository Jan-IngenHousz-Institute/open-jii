"use client";

import { Check, Sparkles } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

export type ColumnStatus = "described" | "suggested" | "not-described" | "layout";

interface ColumnDescriptionStatusProps {
  status: ColumnStatus;
}

export function ColumnDescriptionStatus({ status }: ColumnDescriptionStatusProps) {
  const { t } = useTranslation("studyMetadata");

  switch (status) {
    case "described":
      return (
        <Badge variant="secondary">
          <Check />
          {t("dictionary.described")}
        </Badge>
      );
    case "suggested":
      return (
        <Badge variant="outline">
          <Sparkles />
          {t("dictionary.suggested")}
        </Badge>
      );
    case "layout":
      return <span className="text-muted-foreground text-sm">{t("dictionary.fromLayout")}</span>;
    case "not-described":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {t("dictionary.notDescribed")}
        </Badge>
      );
  }
}
