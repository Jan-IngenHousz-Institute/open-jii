"use client";

import { useTranslation } from "@repo/i18n";

const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ReadinessRingProps {
  filled: number;
  total: number;
}

/** How many standard fields the trial fills, as a small ring. */
export function ReadinessRing({ filled, total }: ReadinessRingProps) {
  const { t } = useTranslation("readinessConceptC");
  const fraction = total > 0 ? filled / total : 0;

  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label={t("strip.ring", { filled, total })}
      className="size-9 shrink-0 -rotate-90"
    >
      <circle cx="20" cy="20" r={RADIUS} fill="none" strokeWidth={5} className="stroke-muted" />
      <circle
        cx="20"
        cy="20"
        r={RADIUS}
        fill="none"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        className="stroke-primary"
      />
    </svg>
  );
}
