"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";

import type { DatasetState } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

const STATE_TONES: Record<DatasetState, StatusTone> = {
  draft: "archived",
  published: "published",
  superseded: "stale",
  withdrawn: "destructive",
};

export function DatasetStateBadge({ state }: { state: DatasetState }) {
  const { t } = useTranslation("datasets");

  return <StatusBadge tone={STATE_TONES[state]}>{t(`state.${state}`)}</StatusBadge>;
}
