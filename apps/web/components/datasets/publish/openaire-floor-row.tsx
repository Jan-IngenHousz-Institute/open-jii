"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Check, X } from "lucide-react";

import type {
  DatasetReadiness,
  OpenAireFloorField,
} from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface OpenAireFloorRowProps {
  floor: DatasetReadiness["floor"];
  /** What this dataset holds for each filled field, so the record reads as its own state. */
  values?: Partial<Record<OpenAireFloorField, string>>;
  /** The flow's step that fills a missing field, when there is one. */
  onFix?: (field: OpenAireFloorField) => { label: string; go: () => void } | null;
}

/** The OpenAIRE record every dataset follows, filled by the publish flow's own steps. */
export function OpenAireFloorRow({ floor, values, onFix }: OpenAireFloorRowProps) {
  const { t } = useTranslation("datasets");
  const isComplete = floor.missing.length === 0;

  const renderFilled = (field: OpenAireFloorField) => {
    const value = values?.[field];

    return (
      <li key={field} className="flex items-start gap-2 text-sm">
        <Check className="text-status-active-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{t(`check.fields.${field}`)}</p>
          {value !== undefined ? <p className="break-words font-medium">{value}</p> : null}
        </div>
      </li>
    );
  };

  const renderMissing = (field: OpenAireFloorField) => {
    const fix = onFix?.(field) ?? null;

    return (
      <li key={field} className="flex items-start gap-2 text-sm">
        <X className="text-status-stale-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-xs">{t(`check.fields.${field}`)}</p>
          {fix !== null ? (
            <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={fix.go}>
              {fix.label}
            </Button>
          ) : null}
        </div>
      </li>
    );
  };

  const verdict = isComplete ? (
    <StatusBadge tone="active">{t("check.recordFilled")}</StatusBadge>
  ) : (
    <StatusBadge tone="stale">
      {t("check.recordMissing", { count: floor.missing.length })}
    </StatusBadge>
  );

  return (
    <SettingsCard
      title={t("check.recordTitle")}
      description={t("check.recordDescription")}
      action={verdict}
      data-testid="openaire-floor"
    >
      <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {floor.missing.map(renderMissing)}
        {floor.filled.map(renderFilled)}
      </ul>
    </SettingsCard>
  );
}
