import { FileSpreadsheet, PencilLine } from "lucide-react";

import type { PlotAttribute } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface LayoutPlotAttributeProps {
  attribute: PlotAttribute;
  /** Offers Edit value, which opens the sheet the value came from. */
  canEdit: boolean;
}

export function LayoutPlotAttribute({ attribute, canEdit }: LayoutPlotAttributeProps) {
  const { t } = useTranslation("experiments");
  const { source } = attribute;

  const isEdited = source.type === "edit";
  const SourceIcon = isEdited ? PencilLine : FileSpreadsheet;
  const sourceLabel = isEdited
    ? t("layout.plot.source.edit", { sheet: source.sheetName })
    : t("layout.plot.source.sheet", { sheet: source.sheetName });

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 space-y-0.5">
        <dt className="text-muted-foreground text-xs">{attribute.name}</dt>
        <dd className="text-sm font-medium">{attribute.value}</dd>
        <dd className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <SourceIcon className="size-3.5 shrink-0" aria-hidden />
          {sourceLabel}
        </dd>
      </div>
      {canEdit ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-7 px-2"
          aria-label={t("layout.plot.editValue", { name: attribute.name })}
        >
          {t("layout.plot.edit")}
        </Button>
      ) : null}
    </div>
  );
}
