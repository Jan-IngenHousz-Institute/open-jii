"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";
import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";
import { ExternalLink, Flag } from "lucide-react";

import type { FlaggedReading } from "@repo/api/domains/dataset/dataset.schema";
import type { ExperimentAnnotationFlagType } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import { useTranslation } from "@repo/i18n";
import { Switch } from "@repo/ui/components/switch";
import { TableCell, TableRow } from "@repo/ui/components/table";

import { ReadingValues } from "./reading-values";

// The tones the Data tab's annotation cell gives each flag type.
const FLAG_TONES: Record<ExperimentAnnotationFlagType, StatusTone> = {
  outlier: "stale",
  needs_review: "published",
};

interface FlaggedReadingRowProps {
  reading: FlaggedReading;
  /** The Data tab, where the flagged row can be opened. */
  dataHref: string;
  isExcluded: boolean;
  onExcludedChange: (reading: FlaggedReading, isExcluded: boolean) => void;
}

export function FlaggedReadingRow({
  reading,
  dataHref,
  isExcluded,
  onExcludedChange,
}: FlaggedReadingRowProps) {
  const { t } = useTranslation("datasets");
  const { t: tCommon } = useTranslation();
  const locale = useLocale();
  const format = useLocalDateFormat(locale);

  const plot = reading.plot ?? t("curate.noPlot");

  const handleChange = (checked: boolean) => {
    onExcludedChange(reading, checked);
  };

  return (
    <TableRow>
      <TableCell className="pl-4 font-medium">{plot}</TableCell>
      <TableCell className="py-2.5">
        <IntentLink
          href={dataHref}
          aria-label={t("curate.viewReading", { plot })}
          className="hover:text-primary inline-flex items-center gap-1 text-sm"
        >
          {format.dateTime(reading.measuredAt)}
          <ExternalLink className="size-3 shrink-0" aria-hidden />
        </IntentLink>
        <ReadingValues values={reading.values} />
      </TableCell>
      <TableCell>
        <StatusBadge tone={FLAG_TONES[reading.flagType]}>
          <Flag aria-hidden />
          {tCommon(`experimentDataAnnotations.flagTypes.${reading.flagType}`)}
        </StatusBadge>
      </TableCell>
      <TableCell className="whitespace-normal">
        {reading.comment ?? <span className="text-muted-foreground">{t("curate.noComment")}</span>}
      </TableCell>
      <TableCell className="text-muted-foreground">
        <p>{reading.flaggedByName}</p>
        <p className="text-xs">{format.date(reading.flaggedAt)}</p>
      </TableCell>
      <TableCell className="pr-4 text-right">
        <Switch
          checked={isExcluded}
          onCheckedChange={handleChange}
          aria-label={t("curate.excludeLabel", { plot })}
        />
      </TableCell>
    </TableRow>
  );
}
