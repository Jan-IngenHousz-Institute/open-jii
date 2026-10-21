import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime } from "@/util/date";
import { WifiOff } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Progress } from "@repo/ui/components/progress";

import type { PlotShare } from "../plot-state";
import { ShareSwatch } from "./share-swatch";

interface MeasurerProgressProps {
  name: string;
  style: PlotShare | undefined;
  assigned: number;
  measured: number;
  skipped: number;
  lastUploadAt: string | null;
}

// A phone this long without an upload is more often out of signal than stopped.
const QUIET_MS = 15 * 60_000;

/** One measurer's progress through their share, and how long ago their phone last uploaded. */
export function MeasurerProgress({
  name,
  style,
  assigned,
  measured,
  skipped,
  lastUploadAt,
}: MeasurerProgressProps) {
  const { t } = useTranslation("fieldSessions");
  const locale = useLocale();

  const toMeasure = assigned - measured - skipped;
  const percent = assigned > 0 ? (measured / assigned) * 100 : 0;
  const hasUploaded = lastUploadAt !== null;
  const isQuiet = hasUploaded && Date.now() - new Date(lastUploadAt).getTime() > QUIET_MS;
  const uploadedAgo = hasUploaded ? formatRelativeTime(lastUploadAt, locale) : "";

  const upload = !hasUploaded ? (
    <p className="text-muted-foreground text-xs">
      <span className="text-foreground font-medium">{t("live.noUpload")}</span>{" "}
      {t("live.noUploadHint")}
    </p>
  ) : isQuiet ? (
    <p className="text-status-stale-foreground flex items-start gap-1.5 text-xs">
      <WifiOff className="mt-px size-3.5 shrink-0" aria-hidden />
      {t("live.quiet", { time: uploadedAgo })}
    </p>
  ) : (
    <p className="text-muted-foreground text-xs">{t("live.uploaded", { time: uploadedAgo })}</p>
  );

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-2 font-medium">
        <ShareSwatch style={style} />
        {name}
      </p>
      <p className="text-sm">{t("live.measuredOf", { measured, total: assigned })}</p>
      <Progress value={percent} className="h-2" />
      <p className="text-muted-foreground text-sm">
        {t("live.skippedToMeasure", { skipped, toMeasure })}
      </p>
      {upload}
    </div>
  );
}
