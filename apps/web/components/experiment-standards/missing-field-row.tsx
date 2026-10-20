"use client";

import { CircleDashed } from "lucide-react";
import Link from "next/link";
import { useLocale } from "~/hooks/useLocale";

import type {
  FieldFix,
  StandardField,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface MissingFieldRowProps {
  experimentId: string;
  field: Extract<StandardField, { status: "missing" }>;
}

/** A field the experiment cannot fill yet: why, and the screen that fills it. */
export function MissingFieldRow({ experimentId, field }: MissingFieldRowProps) {
  const { t } = useTranslation("standards");
  const locale = useLocale();

  const experimentPath = `/${locale}/platform/experiments/${experimentId}`;
  const fixPaths: Record<FieldFix, string> = {
    "connect-orcid": `/${locale}/platform/account`,
    "describe-columns": `${experimentPath}/data`,
    "open-layout": `${experimentPath}/layout`,
    "add-location": experimentPath,
  };

  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <CircleDashed
        aria-label={t("panel.missing")}
        className="text-status-stale-foreground mt-0.5 size-4 shrink-0"
      />

      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs">{t(`field.${field.field}`)}</p>
        <p className="text-sm">{t(`missingReason.${field.reason.code}`, { ...field.reason })}</p>
      </div>

      <Button asChild variant="link" className="h-auto shrink-0 p-0 pt-0.5 text-xs">
        <Link href={fixPaths[field.fix]}>{t(`fix.${field.fix}`)}</Link>
      </Button>
    </li>
  );
}
