"use client";

import { RotateCcw } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

import { useExperimentDistinctValues } from "../../../../../hooks/experiment/useExperimentDistinctValues/useExperimentDistinctValues";
import type { ChartFormValues } from "../../../charts/chart-config";
import { CATEGORY_PALETTE, getCategoryColor } from "../../../charts/colors/palettes";
import { toBucketKey } from "../../../charts/data/cell-coercion";
import { firstDataSourceByRole } from "../../../charts/data/data-sources";

/** Cap the override list so a high-cardinality column doesn't make the
 *  shelf scrollable into oblivion. The user picks colors for the top N
 *  values; everything past the cap falls back to the palette cycle. */
const MAX_CATEGORIES = 50;

interface CategoricalColorMapProps {
  form: UseFormReturn<ChartFormValues>;
}

/**
 * Per-category color picker. Reads the chosen color-dimension column,
 * fetches its distinct values, and renders one row per value with a
 * native color input. Writes to `config.colorMap[bucketKey]`, the same
 * map the renderer's `getCategoryColor` already reads.
 */
export function CategoricalColorMap({ form }: CategoricalColorMapProps) {
  const { t } = useTranslation("experimentVisualizations");
  // experimentId lives in the URL params (`/experiments/[id]/...`); reading
  // it here avoids prop-drilling experimentId through every panel/shelf.
  const params = useParams<{ id?: string }>();
  const experimentId = params?.id;
  const tableName = useWatch({ control: form.control, name: "dataConfig.tableName" });
  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const colorMapValue = useWatch({ control: form.control, name: "config.colorMap" });
  const colorMap = (colorMapValue ?? {}) as Record<string, string>;

  const colorEntry = firstDataSourceByRole(sources, "color");
  const colorColumn = colorEntry?.source.columnName ?? "";

  const {
    values: rawValues,
    truncated,
    isLoading,
  } = useExperimentDistinctValues({
    experimentId: experimentId ?? "",
    tableName: tableName ?? "",
    column: colorColumn,
    limit: MAX_CATEGORIES,
    enabled: Boolean(experimentId) && Boolean(tableName) && Boolean(colorColumn),
  });

  // Sort for stable visual order across renders (the endpoint may return
  // values in arbitrary order). Stringify once for the comparator.
  const categories = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; label: string }[] = [];
    for (const value of rawValues) {
      const key = toBucketKey(value);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: key === "" ? t("workspace.shelves.colorMap.nullLabel") : key });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [rawValues, t]);

  const setOverride = (key: string, hex: string) => {
    form.setValue("config.colorMap", { ...colorMap, [key]: hex }, { shouldDirty: true });
  };

  const clearOverride = (key: string) => {
    const next = { ...colorMap };
    delete next[key];
    form.setValue("config.colorMap", next, { shouldDirty: true });
  };

  const clearAll = () => {
    form.setValue("config.colorMap", {}, { shouldDirty: true });
  };

  if (!experimentId || !tableName || !colorColumn) {
    // Outside the workspace (e.g. dashboard preview) or before a column
    // is picked, just show the palette swatches so users know what they
    // get by default.
    return <PalettePreview />;
  }

  if (isLoading) {
    return (
      <div className="text-muted-foreground text-xs">
        {t("workspace.shelves.colorMap.loading")}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-muted-foreground text-xs">
        {t("workspace.shelves.colorMap.empty")}
      </div>
    );
  }

  const hasAnyOverride = categories.some((c) => Boolean(colorMap[c.key]));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-xs font-medium">
          {t("workspace.shelves.colorMap.title")}
        </div>
        {hasAnyOverride && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-6 px-2 text-[11px]"
            onClick={clearAll}
          >
            {t("workspace.shelves.colorMap.resetAll")}
          </Button>
        )}
      </div>

      {/* Bordered container groups the rows visually and scopes the scroll.
          Scrolls past ~6 rows so a high-cardinality column doesn't push
          the rest of the shelf off-screen. */}
      <div className="bg-muted/30 max-h-[220px] overflow-y-auto rounded-md border p-2">
        <ul className="space-y-1">
          {categories.map((c, i) => {
            const effective = getCategoryColor(i, colorMap, c.key);
            const isOverridden = Boolean(colorMap[c.key]);
            return (
              <li key={c.key} className="flex items-center gap-2 py-0.5">
                <span
                  className="text-foreground min-w-0 max-w-[40%] shrink-0 truncate text-xs font-medium"
                  title={c.label}
                >
                  {c.label}
                </span>
                {/* Dotted leader visually ties label to controls and gives the
                    row a settings-list feel rather than a flat input grid. */}
                <span
                  aria-hidden
                  className="border-muted-foreground/25 min-w-3 flex-1 border-b border-dotted"
                />
                <Input
                  type="color"
                  className="h-7 w-9 shrink-0 p-1"
                  value={effective}
                  onChange={(e) => setOverride(c.key, e.target.value)}
                  aria-label={t("workspace.shelves.colorMap.pickerLabel", { name: c.label })}
                />
                <Input
                  type="text"
                  className="h-7 w-[74px] shrink-0 px-1.5 font-mono text-[11px] uppercase"
                  placeholder="#000000"
                  value={effective}
                  onChange={(e) => setOverride(c.key, e.target.value)}
                  aria-label={t("workspace.shelves.colorMap.pickerLabel", { name: c.label })}
                />
                {isOverridden ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground h-7 w-7 shrink-0 p-0"
                    onClick={() => clearOverride(c.key)}
                    aria-label={t("workspace.shelves.colorMap.resetOne", { name: c.label })}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  // Keep alignment when the reset button is hidden so the
                  // row doesn't visually jitter as overrides toggle.
                  <span className="h-7 w-7 shrink-0" aria-hidden />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {truncated && (
        <p className="text-muted-foreground text-[11px] italic">
          {t("workspace.shelves.colorMap.truncated", { count: MAX_CATEGORIES })}
        </p>
      )}
    </div>
  );
}

function PalettePreview() {
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
