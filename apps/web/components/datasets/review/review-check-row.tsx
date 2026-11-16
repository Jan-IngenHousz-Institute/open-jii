"use client";

import { ScanSearch } from "lucide-react";

import type { ReviewCheck, ReviewCheckItem } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Label } from "@repo/ui/components/label";

interface ReviewCheckRowProps {
  check: ReviewCheck;
  isConfirmed: boolean;
  onToggle: (item: ReviewCheckItem) => void;
}

/** One point a steward confirms, with what the platform found about it where it looked. */
export function ReviewCheckRow({ check, isConfirmed, onToggle }: ReviewCheckRowProps) {
  const { t } = useTranslation("datasets");
  const id = `review-check-${check.item}`;

  const handleChange = () => onToggle(check.item);

  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Checkbox id={id} checked={isConfirmed} onCheckedChange={handleChange} className="mt-0.5" />
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id} className="font-normal leading-snug">
          {t(`review.checks.${check.item}`)}
        </Label>
        {check.finding !== null ? (
          <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            <ScanSearch className="text-primary mt-px size-3.5 shrink-0" aria-hidden />
            {t("review.finding", { finding: check.finding })}
          </p>
        ) : null}
      </div>
    </li>
  );
}
