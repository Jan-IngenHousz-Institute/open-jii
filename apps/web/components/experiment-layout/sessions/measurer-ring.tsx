import { formatHm } from "@/util/date";

import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { measurerTone } from "./session-tones";

interface MeasurerRingProps {
  name: string;
  shareIndex: number;
  assigned: number;
  measured: number;
  skipped: number;
  lastUploadAt: string | null;
}

const RADIUS = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function MeasurerRing({
  name,
  shareIndex,
  assigned,
  measured,
  skipped,
  lastUploadAt,
}: MeasurerRingProps) {
  const { t } = useTranslation("fieldSessions");
  const fraction = assigned > 0 ? measured / assigned : 0;
  const toDo = assigned - measured - skipped;

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 72 72" className="size-20 -rotate-90" aria-hidden>
          <circle cx="36" cy="36" r={RADIUS} fill="none" strokeWidth={7} className="stroke-muted" />
          <circle
            cx="36"
            cy="36"
            r={RADIUS}
            fill="none"
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={`${fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            className={measurerTone(shareIndex).stroke}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold">
          {measured}
        </span>
      </div>
      <div className="space-y-0.5">
        <p className="flex items-center gap-2 font-medium">
          <span className={cn("size-3 rounded-sm border-2", measurerTone(shareIndex).border)} />
          {name}
        </p>
        <p className="text-sm">{t("live.measuredOf", { measured, total: assigned })}</p>
        <p className="text-muted-foreground text-sm">{t("live.skippedToDo", { skipped, toDo })}</p>
        <p className="text-muted-foreground text-xs">
          {lastUploadAt
            ? t("live.lastUpload", { time: formatHm(new Date(lastUploadAt)) })
            : t("live.noUpload")}
        </p>
      </div>
    </div>
  );
}
