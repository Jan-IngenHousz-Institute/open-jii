import { formatDate } from "@/util/date";
import { FileSpreadsheet, PencilLine, Smartphone } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

import type { HistoryEntry } from "./plot-attribute-history";

interface LayoutAttributeVersionProps {
  entry: HistoryEntry;
  /** Shows the value above its line, as the history beneath the current value does. */
  showsValue: boolean;
}

const SOURCE_ICONS = { sheet: FileSpreadsheet, edit: PencilLine, phone: Smartphone } as const;

/** One version of a plot attribute: its value, when it applies from and where it came from. */
export function LayoutAttributeVersion({ entry, showsValue }: LayoutAttributeVersionProps) {
  const { t } = useTranslation("experiments");
  const { version, isUpcoming, isCorrected } = entry;
  const { source } = version;

  const SourceIcon = SOURCE_ICONS[source.type];
  const recorded = formatDate(version.recordedAt);
  const applies =
    version.appliesFrom === null
      ? t("layout.plot.version.fromStart")
      : t("layout.plot.version.fromDate", { date: formatDate(version.appliesFrom) });

  const typedOrEntered = source.type === "phone" ? "phone" : "planned";
  const origin =
    source.type === "sheet"
      ? t("layout.plot.version.sheet", { sheet: source.sheetName, row: source.row })
      : t(`layout.plot.version.${typedOrEntered}`, { name: version.recordedBy, recorded });

  const line =
    version.correctionReason === null
      ? t("layout.plot.version.line", { applies, origin })
      : t("layout.plot.version.correction", {
          name: version.recordedBy,
          recorded,
          reason: version.correctionReason,
        });

  return (
    <div className="space-y-0.5">
      {showsValue ? (
        <p className="flex items-center gap-2 text-sm">
          <span className={cn(isCorrected && "text-muted-foreground line-through")}>
            {version.value}
          </span>
          {isUpcoming ? (
            <Badge variant="secondary">{t("layout.plot.version.upcoming")}</Badge>
          ) : null}
          {isCorrected ? (
            <span className="text-muted-foreground text-xs">
              {t("layout.plot.version.corrected")}
            </span>
          ) : null}
        </p>
      ) : null}
      <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
        <SourceIcon className="mt-px size-3.5 shrink-0" aria-hidden />
        {line}
      </p>
    </div>
  );
}
