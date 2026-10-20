"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Check, X } from "lucide-react";

import type {
  DatasetReadiness,
  OpenAireFloorField,
} from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";

/** The one row that blocks: each floor field is either filled or stops the freeze. */
export function OpenAireFloorRow({ floor }: { floor: DatasetReadiness["floor"] }) {
  const { t } = useTranslation("datasets");
  const isComplete = floor.missing.length === 0;

  const renderField = (field: OpenAireFloorField, isFilled: boolean) => (
    <li key={field} className="flex items-center gap-1.5 text-sm">
      {isFilled ? (
        <Check className="text-status-active-foreground size-3.5" aria-hidden />
      ) : (
        <X className="text-destructive size-3.5" aria-hidden />
      )}
      {t(`check.floorFields.${field}`)}
    </li>
  );

  const verdict = isComplete ? (
    <StatusBadge tone="active">{t("check.floorComplete")}</StatusBadge>
  ) : (
    <StatusBadge tone="destructive">
      {t("check.floorMissing", { count: floor.missing.length })}
    </StatusBadge>
  );

  return (
    <SettingsCard
      title={t("check.floorTitle")}
      description={t("check.floorDescription")}
      action={verdict}
      data-testid="openaire-floor"
    >
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
        {floor.filled.map((field) => renderField(field, true))}
        {floor.missing.map((field) => renderField(field, false))}
      </ul>
    </SettingsCard>
  );
}
