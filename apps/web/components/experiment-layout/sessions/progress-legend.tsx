import { useTranslation } from "@repo/i18n";

export function ProgressLegend() {
  const { t } = useTranslation("fieldSessions");

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="flex items-center gap-1.5">
        <span className="bg-foreground/40 size-3 rounded-sm" />
        {t("live.legendMeasured")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="bg-foreground/10 size-3 rounded-sm" />
        {t("live.legendNotMeasured")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="border-foreground/60 size-3 rounded-sm border border-dashed" />
        {t("live.legendSkipped")}
      </span>
    </div>
  );
}
