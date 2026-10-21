import { formatHm } from "@/util/date";

import type {
  MeasuredTwiceReading,
  ReadingValue,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface MeasuredTwiceReadingRowProps {
  reading: MeasuredTwiceReading;
  name: string;
  canEdit: boolean;
}

/** One of the readings on a plot measured twice, with its values and the two ways to settle it. */
export function MeasuredTwiceReadingRow({ reading, name, canEdit }: MeasuredTwiceReadingRowProps) {
  const { t } = useTranslation("fieldSessions");

  // Scaffold: recording a decision is not built yet.
  const keep = () => undefined;
  const move = () => undefined;

  const renderValue = (value: ReadingValue) => (
    <div key={value.label} className="flex gap-1.5">
      <dt className="text-muted-foreground">{value.label}</dt>
      <dd className="font-medium tabular-nums">{value.value}</dd>
    </div>
  );

  return (
    <li className="space-y-2 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{name}</span>
        <span className="text-muted-foreground">
          {t("measuredTwice.reading", {
            phone: reading.phone,
            time: formatHm(new Date(reading.measuredAt)),
          })}
        </span>
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{reading.values.map(renderValue)}</dl>
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={keep}>
            {t("measuredTwice.keep")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={move}>
            {t("measuredTwice.move")}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
