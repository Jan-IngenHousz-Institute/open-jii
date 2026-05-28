"use client";

import { useTranslation } from "@repo/i18n";

import { CATEGORY_PALETTE } from "../../../charts/colors/palettes";

export function CategoricalColorPreview() {
  const { t } = useTranslation("experimentVisualizations");
  return (
    <div>
      <div className="text-muted-foreground mb-1 text-xs font-medium">
        {t("workspace.shelves.preview")}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_PALETTE.slice(0, 12).map((color) => (
          <div
            key={color}
            className="h-4 w-4 rounded-sm border border-black/10"
            style={{ background: color }}
          />
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
        {t("workspace.shelves.colorModeCategoricalHelp")}
      </p>
    </div>
  );
}
