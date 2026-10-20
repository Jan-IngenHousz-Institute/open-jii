import { formatHm } from "@/util/date";

import type {
  ConflictReading,
  Measurer,
  PlotConflict,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface ConflictCardProps {
  conflict: PlotConflict;
  plot: string;
  measurers: readonly Measurer[];
}

export function ConflictCard({ conflict, plot, measurers }: ConflictCardProps) {
  const { t } = useTranslation("fieldSessions");

  const renderReading = (reading: ConflictReading) => (
    <li
      key={`${reading.userId}-${reading.measuredAt}`}
      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
    >
      <span className="font-medium">
        {measurers.find((measurer) => measurer.userId === reading.userId)?.name ?? ""}
      </span>
      <span className="text-muted-foreground">
        {t("review.reading", {
          phone: reading.phone,
          time: formatHm(new Date(reading.measuredAt)),
        })}
      </span>
    </li>
  );

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="font-medium">{t("review.plot", { plot })}</p>
        <p className="text-muted-foreground text-sm">{t("review.explanation", { plot })}</p>
      </div>
      <ul className="divide-y rounded-md border">{conflict.readings.map(renderReading)}</ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm">
          {t("review.keepOne")}
        </Button>
        <Button type="button" variant="outline" size="sm">
          {t("review.keepBoth")}
        </Button>
        <Button type="button" variant="outline" size="sm">
          {t("review.move")}
        </Button>
      </div>
    </div>
  );
}
