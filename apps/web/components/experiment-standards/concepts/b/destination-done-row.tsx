"use client";

import { Check } from "lucide-react";

import { useTranslation } from "@repo/i18n";

import type { DoneItem } from "./readiness-destinations";

interface DestinationDoneRowProps {
  item: DoneItem;
}

/** Something the destination needs that the trial already has. */
export function DestinationDoneRow({ item }: DestinationDoneRowProps) {
  const { t } = useTranslation("readinessConceptB");

  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground min-w-0">{t(`done.${item}`)}</span>
      <Check
        aria-label={t("done.label")}
        className="text-status-active-foreground size-4 shrink-0"
      />
    </li>
  );
}
