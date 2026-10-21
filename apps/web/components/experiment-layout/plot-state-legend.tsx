import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { PlotMarkGlyph } from "./plot-mark-glyph";
import type {
  PlotCategories,
  PlotCategory,
  PlotLegendEntry,
  PlotShare,
  PlotShares,
} from "./plot-state";

export interface PlotStateLegendProps {
  /** What the fill encodes, such as Treatment. Shown before the categories. */
  categoryName?: string;
  categories?: PlotCategories;
  shares?: PlotShares;
  /** The glyphs and looks this grid can show, in the order the legend lists them. */
  entries?: readonly PlotLegendEntry[];
}

const ENTRY_LABELS: Record<PlotLegendEntry, string> = {
  measured: "layout.legend.measured",
  skipped: "layout.legend.skipped",
  current: "layout.legend.current",
  measuredTwice: "layout.legend.measuredTwice",
  outsideShare: "layout.legend.outsideShare",
  notYours: "layout.legend.notYours",
  gap: "layout.legend.gap",
  removed: "layout.legend.removed",
};

function EntrySwatch({ entry }: { entry: PlotLegendEntry }) {
  if (entry === "gap") {
    return <span className="border-muted-foreground/60 size-3.5 rounded-sm border border-dotted" />;
  }
  if (entry === "notYours") {
    return (
      <span className="bg-muted-foreground/30 border-foreground/15 size-3.5 rounded-sm border opacity-40" />
    );
  }
  return <PlotMarkGlyph mark={entry} />;
}

/** The key under a grid drawn with PlotStateCell, listing only what that grid can show. */
export function PlotStateLegend({
  categoryName,
  categories,
  shares,
  entries = [],
}: PlotStateLegendProps) {
  const { t } = useTranslation("experiments");

  const renderCategory = (category: PlotCategory) => (
    <span key={category.value} className="flex items-center gap-1.5">
      <span
        className={cn(
          "border-foreground/15 text-foreground/70 flex size-4 items-center justify-center rounded-sm border text-[10px] font-semibold",
          category.fillClassName ?? "bg-muted/50",
        )}
      >
        {category.code}
      </span>
      {category.value}
    </span>
  );

  const renderShare = (share: PlotShare) => (
    <span key={share.name} className="flex items-center gap-1.5">
      <span
        className={cn(
          "flex h-4 min-w-6 items-center justify-center rounded-sm border-2 px-0.5 text-[9px] font-semibold",
          share.borderClassName,
        )}
      >
        {share.initials}
      </span>
      {share.name}
    </span>
  );

  const renderEntry = (entry: PlotLegendEntry) => (
    <span key={entry} className="flex items-center gap-1.5">
      <EntrySwatch entry={entry} />
      {t(ENTRY_LABELS[entry])}
    </span>
  );

  const hasCategories = categories !== undefined && !categories.isEmpty;

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      {hasCategories ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {categoryName ? (
            <span className="text-foreground font-medium">{categoryName}</span>
          ) : null}
          {categories.entries.map(renderCategory)}
        </span>
      ) : null}
      {shares ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {shares.entries.map(renderShare)}
        </span>
      ) : null}
      {entries.map(renderEntry)}
    </div>
  );
}
