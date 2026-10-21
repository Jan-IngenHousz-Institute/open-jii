import type { ReactNode } from "react";

import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { PlotMarkGlyph } from "./plot-mark-glyph";
import type { PlotCategory, PlotCellKind, PlotMark, PlotShare } from "./plot-state";

export interface PlotStateCellProps {
  kind: PlotCellKind;
  /** The plot's name. A gap has none. */
  identifier?: string;
  /** Fill and code, from PlotCategories. Neutral when absent. */
  category?: PlotCategory;
  /** Border, from PlotShares. Neutral when absent. */
  share?: PlotShare;
  mark?: PlotMark;
  /** Dimming means only "not yours". */
  isDimmed?: boolean;
  isSelected?: boolean;
  /** Small tiles that drop the code and glyph padding, for large fields. */
  isCompact?: boolean;
  /** Replaces the name in the middle, such as a walking order position. */
  label?: ReactNode;
}

/**
 * One position drawn by the plot-state legend. Presentational: a grid wraps it in a button or
 * gives the wrapper its pointer handlers, so every grid draws a plot the same way.
 */
export function PlotStateCell({
  kind,
  identifier,
  category,
  share,
  mark,
  isDimmed = false,
  isSelected = false,
  isCompact = false,
  label,
}: PlotStateCellProps) {
  const { t } = useTranslation("experiments");

  if (kind === "gap") {
    return (
      <div
        title={t("layout.legend.gap")}
        className="border-muted-foreground/40 h-full w-full rounded-md border border-dotted"
      />
    );
  }

  const isRemoved = kind === "removed";
  const hasCode = category !== undefined && !isCompact;
  const glyph = isRemoved ? "removed" : mark;

  return (
    <div
      title={identifier}
      className={cn(
        "text-foreground relative flex h-full w-full items-center justify-center rounded-md font-medium",
        isCompact ? "text-[10px]" : "text-xs",
        isRemoved ? "bg-muted/30" : (category?.fillClassName ?? "bg-muted/50"),
        share ? cn("border-[3px]", share.borderClassName) : "border-foreground/15 border",
        isRemoved && "text-muted-foreground line-through",
        isDimmed && "opacity-40",
        isSelected && "ring-foreground ring-2 ring-offset-1",
      )}
    >
      {label ?? identifier}
      {hasCode ? (
        <span className="text-foreground/70 absolute bottom-0.5 left-1 text-[10px] font-semibold leading-none">
          {category.code}
        </span>
      ) : null}
      {glyph === undefined ? null : (
        <span className="absolute right-0.5 top-0.5">
          <PlotMarkGlyph mark={glyph} className={isCompact ? "size-2.5" : undefined} />
        </span>
      )}
    </div>
  );
}
