import { useLocale } from "@/hooks/useLocale";

import type {
  MeasuredTwicePlot,
  MeasuredTwiceReading,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";

import { MeasuredTwiceReadingRow } from "./measured-twice-reading";

interface MeasuredTwiceItemProps {
  plot: MeasuredTwicePlot;
  plotName: string;
  nameOf: (userId: string) => string;
  canEdit: boolean;
}

/** One plot measured twice, with every reading on it and what each one recorded. */
export function MeasuredTwiceItem({ plot, plotName, nameOf, canEdit }: MeasuredTwiceItemProps) {
  const { t } = useTranslation("fieldSessions");
  const locale = useLocale();

  const names = [...new Set(plot.readings.map((reading) => nameOf(reading.userId)))];
  const nameList = new Intl.ListFormat(locale, { type: "conjunction" }).format(names);

  const renderReading = (reading: MeasuredTwiceReading) => (
    <MeasuredTwiceReadingRow
      key={reading.readingId}
      reading={reading}
      name={nameOf(reading.userId)}
      canEdit={canEdit}
    />
  );

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="font-medium">{plotName}</p>
        <p className="text-muted-foreground text-sm">
          {t("measuredTwice.explanation", { names: nameList, plot: plotName })}
        </p>
      </div>
      <ul className="divide-y rounded-md border">{plot.readings.map(renderReading)}</ul>
    </div>
  );
}
