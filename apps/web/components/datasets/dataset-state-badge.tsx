"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";

import type { DatasetState } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

// Superseded is not a fault, so it gets no fill at all.
const STATE_TONES: Record<Exclude<DatasetState, "superseded">, StatusTone> = {
  draft: "archived",
  published: "published",
  withdrawn: "destructive",
};

export function DatasetStateBadge({ state }: { state: DatasetState }) {
  const { t } = useTranslation("datasets");

  if (state === "superseded") {
    return (
      <Badge variant="outline" className="text-muted-foreground font-medium">
        {t("state.superseded")}
      </Badge>
    );
  }

  return <StatusBadge tone={STATE_TONES[state]}>{t(`state.${state}`)}</StatusBadge>;
}
