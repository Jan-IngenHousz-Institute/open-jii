"use client";

import { useTranslation } from "@repo/i18n/client";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";

import { StatusTitle } from "./status-title";

const PULSE = "animate-none motion-safe:animate-pulse";

// Appears by CSS alone, because the script that would count the seconds may be the slow part.
const SLOW_NOTICE =
  "text-muted-foreground animate-in fade-in fill-mode-both delay-[10s] animation-duration-500";

export function StatusSkeleton() {
  const { t } = useTranslation("status");

  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <p role="status" className="sr-only">
        {t("skeleton.label")}
      </p>
      <StatusTitle>
        <Skeleton className={cn("h-5 w-80 max-w-full", PULSE)} />
      </StatusTitle>
      <Skeleton className={cn("h-20 w-full rounded-xl", PULSE)} />
      <p aria-hidden className={SLOW_NOTICE}>
        {t("skeleton.slow")}
      </p>
      <Skeleton className={cn("h-96 w-full rounded-xl", PULSE)} />
      <Skeleton className={cn("h-32 w-full rounded-xl", PULSE)} />
    </div>
  );
}
