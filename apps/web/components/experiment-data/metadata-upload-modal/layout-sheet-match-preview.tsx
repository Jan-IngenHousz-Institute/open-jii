import { useExperimentLayoutSheetPreview } from "@/hooks/experiment/useExperimentLayoutSheetPreview/useExperimentLayoutSheetPreview";
import { ListChecks, Loader2 } from "lucide-react";

import { useTranslation } from "@repo/i18n/client";

interface LayoutSheetMatchPreviewProps {
  experimentId: string;
  identifiers: string[];
  levelName: string;
}

const NAMES_SHOWN = 5;

export function LayoutSheetMatchPreview({
  experimentId,
  identifiers,
  levelName,
}: LayoutSheetMatchPreviewProps) {
  const { t } = useTranslation("experiments");
  const { data: preview } = useExperimentLayoutSheetPreview(experimentId, identifiers);
  const level = levelName.toLowerCase();

  if (preview === undefined) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("layout.sheetMatch.checking")}
      </p>
    );
  }

  const listNames = (names: string[]) => {
    const shown = names.slice(0, NAMES_SHOWN).join(", ");
    const hidden = names.length - NAMES_SHOWN;
    return hidden > 0 ? t("layout.sheetMatch.moreNames", { names: shown, count: hidden }) : shown;
  };

  const { matchedRowCount, unmatchedNames, plotsWithoutRow, duplicateNames, readingsWithPlot } =
    preview;
  const hasDuplicates = duplicateNames.length > 0;
  const hasReadings = readingsWithPlot > 0;

  const matched = t("layout.sheetMatch.matched", { count: matchedRowCount });
  const unmatched =
    unmatchedNames.length === 0
      ? t("layout.sheetMatch.unmatchedNone", { level })
      : t("layout.sheetMatch.unmatched", {
          count: unmatchedNames.length,
          level,
          names: listNames(unmatchedNames),
        });
  const withoutRow =
    plotsWithoutRow.length === 0
      ? t("layout.sheetMatch.withoutRowNone", { level })
      : t("layout.sheetMatch.withoutRow", {
          count: plotsWithoutRow.length,
          names: listNames(plotsWithoutRow),
        });

  return (
    <div className="bg-muted/40 flex gap-2 rounded-md border px-3 py-2 text-sm">
      <ListChecks className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p>{t("layout.sheetMatch.summary", { matched, unmatched, withoutRow })}</p>
        {hasDuplicates ? (
          <p className="text-muted-foreground">
            {t("layout.sheetMatch.duplicates", { names: listNames(duplicateNames) })}
          </p>
        ) : null}
        <p className="text-muted-foreground" data-readings-with-plot>
          {hasReadings
            ? t("layout.sheetMatch.readings", { count: readingsWithPlot, level })
            : t("layout.sheetMatch.noReadings", { level })}
        </p>
      </div>
    </div>
  );
}
