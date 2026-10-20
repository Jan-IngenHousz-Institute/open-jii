"use client";

import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

interface DestinationProgressProps {
  filled: number;
  total: number;
  isMet: boolean;
}

/** One segment per field the destination asks for, filled where the trial already has it. */
export function DestinationProgress({ filled, total, isMet }: DestinationProgressProps) {
  const { t } = useTranslation("readinessConceptB");

  const segments = Array.from({ length: total }, (_, index) => index < filled);
  const fillClass = isMet ? "bg-status-active-foreground" : "bg-primary";

  const renderSegment = (isFilled: boolean, index: number) => (
    <span
      key={index}
      className={cn("h-1.5 flex-1 rounded-full", isFilled ? fillClass : "bg-primary/15")}
    />
  );

  return (
    <div
      role="progressbar"
      aria-valuenow={filled}
      aria-valuemax={total}
      aria-label={t("progress", { filled, total })}
      className="flex gap-0.5"
    >
      {segments.map(renderSegment)}
    </div>
  );
}
