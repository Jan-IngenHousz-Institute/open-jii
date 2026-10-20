import { FileSpreadsheet, Grid3x3, PencilLine } from "lucide-react";

import type { PlotAttribute } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";

interface LayoutPlotAttributeProps {
  attribute: PlotAttribute;
}

export function LayoutPlotAttribute({ attribute }: LayoutPlotAttributeProps) {
  const { t } = useTranslation("experiments");
  const { source } = attribute;

  const SourceIcon =
    source.type === "layout" ? Grid3x3 : source.type === "sheet" ? FileSpreadsheet : PencilLine;
  const sourceLabel =
    source.type === "layout"
      ? t("layout.plot.source.layout")
      : source.type === "sheet"
        ? t("layout.plot.source.sheet", { sheet: source.sheetName })
        : t("layout.plot.source.edit", { sheet: source.sheetName });

  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-muted-foreground text-xs">{attribute.name}</dt>
      <dd className="text-sm font-medium">{attribute.value}</dd>
      <dd className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <SourceIcon className="size-3.5 shrink-0" aria-hidden />
        {sourceLabel}
      </dd>
    </div>
  );
}
