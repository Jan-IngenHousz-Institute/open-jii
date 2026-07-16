"use client";

import { RotateCcw } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { WellKnownColumnTypes } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { FormColorInput } from "@repo/ui/components/form-color-input";

import { useExperimentDistinctValues } from "../../../../../hooks/experiment/useExperimentDistinctValues/useExperimentDistinctValues";
import type { ChartFormValues } from "../../../charts/chart-config";
import {
  CATEGORY_PALETTE,
  composeColorMapKey,
  getCategoryColor,
} from "../../../charts/colors/palettes";
import { toBucketKey } from "../../../charts/data/cell-coercion";
import { contributorDisplayName } from "../../../charts/data/contributor-cells";
import { dataSourcesByRole, firstDataSourceByRole } from "../../../charts/data/data-sources";
import { deviceDisplayName } from "../../../charts/data/device-cells";

/** Cap the override list so a high-cardinality column doesn't make the
 *  shelf scrollable into oblivion. The user picks colors for the top N
 *  values; everything past the cap falls back to the palette cycle. */
const MAX_CATEGORIES = 50;

interface CategoricalColorMapProps {
  form: UseFormReturn<ChartFormValues>;
  columns: ExperimentDataColumn[];
}

interface Category {
  key: string;
  label: string;
}

/**
 * Per-category color picker. Reads the chosen color-dimension column,
 * fetches its distinct values, and renders one row per value with a
 * native color input.
 *
 * - With a single Y series (or none), writes plain `colorMap[categoryKey]`.
 *   That key applies to every series for that category.
 * - With 2+ Y series, renders one section per Y series and writes
 *   composite `colorMap["seriesKey::categoryKey"]` entries. The renderer's
 *   `getCategoryColor` tries the composite first, falls back to the plain
 *   category key, then to the palette -- so old single-key colorMaps keep
 *   working as "default for all series".
 */
export function CategoricalColorMap({ form, columns }: CategoricalColorMapProps) {
  const { t } = useTranslation("experimentVisualizations");
  const params = useParams<{ id?: string }>();
  const experimentId = params.id;
  const tableName = useWatch({ control: form.control, name: "dataConfig.tableName" });
  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const colorMapValue = useWatch({ control: form.control, name: "config.colorMap" });
  const colorMap: Record<string, string> = colorMapValue ?? {};

  const colorEntry = firstDataSourceByRole(sources, "color");
  const colorColumn = colorEntry?.source.columnName ?? "";

  // CONTRIBUTOR distinct values arrive as STRUCT JSON; the renderer flattens
  // them to the contributor name, so the picker must key/label by name too or
  // the overrides never match what the chart looks up.
  const colorColumnType = columns.find((c) => c.name === colorColumn)?.type_text;
  const isContributor = colorColumnType === WellKnownColumnTypes.CONTRIBUTOR;
  const isDevice = colorColumnType === WellKnownColumnTypes.DEVICE;

  // Mirror the renderer's seriesKey for `getCategoryColor` lookups.
  const seriesKeys = useMemo(() => {
    return dataSourcesByRole(sources, "y")
      .map(({ source }) => source.alias ?? source.columnName)
      .filter((s): s is string => Boolean(s) && s.length > 0);
  }, [sources]);

  const {
    values: rawValues,
    truncated,
    isLoading,
  } = useExperimentDistinctValues({
    experimentId: experimentId ?? "",
    tableName: tableName,
    column: colorColumn,
    limit: MAX_CATEGORIES,
    enabled: Boolean(experimentId) && Boolean(tableName) && Boolean(colorColumn),
  });

  // Alphabetical sort so the swatch order matches the renderer's palette indices.
  const categories = useMemo<Category[]>(() => {
    const seen = new Set<string>();
    const out: Category[] = [];
    for (const value of rawValues) {
      const key = isContributor
        ? contributorDisplayName(value)
        : isDevice
          ? deviceDisplayName(value)
          : toBucketKey(value);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: key === "" ? t("workspace.shelves.colorMap.nullLabel") : key });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [rawValues, isContributor, isDevice, t]);

  // Read the live colorMap at commit time, not the render-time snapshot:
  // debounced swatch commits from different rows can land close together and
  // a closed-over snapshot would drop a sibling row's just-committed color.
  const setOverride = (mapKey: string, hex: string) => {
    const current = form.getValues("config.colorMap") ?? {};
    form.setValue("config.colorMap", { ...current, [mapKey]: hex }, { shouldDirty: true });
  };

  const clearOverride = (mapKey: string) => {
    const next = { ...(form.getValues("config.colorMap") ?? {}) };
    delete next[mapKey];
    form.setValue("config.colorMap", next, { shouldDirty: true });
  };

  const clearAll = () => {
    form.setValue("config.colorMap", {}, { shouldDirty: true });
  };

  if (!experimentId || !tableName || !colorColumn) {
    return <PalettePreview />;
  }

  if (isLoading) {
    return (
      <div className="text-muted-foreground text-xs">{t("workspace.shelves.colorMap.loading")}</div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-muted-foreground text-xs">{t("workspace.shelves.colorMap.empty")}</div>
    );
  }

  const hasMultipleSeries = seriesKeys.length >= 2;
  const hasAnyOverride = Object.keys(colorMap).length > 0;

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

      {hasMultipleSeries ? (
        <div className="space-y-3">
          {seriesKeys.map((seriesKey, seriesIndex) => (
            <CategorySwatchList
              key={seriesKey}
              heading={seriesKey}
              categories={categories}
              colorMap={colorMap}
              keyFor={(c) => composeColorMapKey(seriesKey, c.key)}
              fallbackKeyFor={(c) => c.key}
              // Match the renderer's palette offset (catIndex + seriesOrdinal * N).
              paletteIndexFor={(_c, i) => seriesIndex * categories.length + i}
              onSet={setOverride}
              onClear={clearOverride}
            />
          ))}
        </div>
      ) : (
        <CategorySwatchList
          categories={categories}
          colorMap={colorMap}
          keyFor={(c) => c.key}
          paletteIndexFor={(_c, i) => i}
          onSet={setOverride}
          onClear={clearOverride}
        />
      )}

      {truncated && (
        <p className="text-muted-foreground text-[11px] italic">
          {t("workspace.shelves.colorMap.truncated", { count: MAX_CATEGORIES })}
        </p>
      )}
    </div>
  );
}

interface CategorySwatchListProps {
  heading?: string;
  categories: Category[];
  colorMap: Record<string, string>;
  /** colorMap key to read/write for this row (plain or composite). */
  keyFor: (c: Category) => string;
  /** Fallback colorMap key probed if `keyFor` has no override (used by
   *  the multi-series mode so categories inherit the plain entry when no
   *  series-specific override is set). */
  fallbackKeyFor?: (c: Category) => string;
  /** Palette index for a row when nothing in `colorMap` matches. Must
   *  mirror the renderer's index choice so swatches show what the chart
   *  would actually draw (renderer uses `catIndex + seriesOrdinal * N`). */
  paletteIndexFor: (c: Category, i: number) => number;
  onSet: (mapKey: string, hex: string) => void;
  onClear: (mapKey: string) => void;
}

function CategorySwatchList({
  heading,
  categories,
  colorMap,
  keyFor,
  fallbackKeyFor,
  paletteIndexFor,
  onSet,
  onClear,
}: CategorySwatchListProps) {
  const { t } = useTranslation("experimentVisualizations");
  return (
    <div className="space-y-1.5">
      {heading && <div className="text-foreground text-xs font-semibold">{heading}</div>}
      <div className="bg-muted/30 max-h-[220px] overflow-y-auto rounded-md border p-2">
        <ul className="space-y-1">
          {categories.map((c, i) => {
            const mapKey = keyFor(c);
            const lookup: Partial<Record<string, string>> = colorMap;
            const explicit = lookup[mapKey];
            const fallbackKey = fallbackKeyFor?.(c);
            const fallbackHit = fallbackKey ? lookup[fallbackKey] : undefined;
            const effective =
              explicit ?? fallbackHit ?? getCategoryColor(paletteIndexFor(c, i), colorMap, c.key);
            const isOverridden = Boolean(explicit);
            return (
              <li key={mapKey} className="flex items-center gap-2 py-0.5">
                <span
                  className="text-foreground min-w-0 max-w-[40%] shrink-0 truncate text-xs font-medium"
                  title={c.label}
                >
                  {c.label}
                </span>
                <span
                  aria-hidden
                  className="border-muted-foreground/25 min-w-3 flex-1 border-b border-dotted"
                />
                <FormColorInput
                  value={effective}
                  fallback={effective}
                  onCommit={(v) => onSet(mapKey, v)}
                  swatchClassName="h-7 w-9"
                  hexClassName="h-7 w-[74px] shrink-0 px-1.5 text-[11px] uppercase"
                  ariaLabel={t("workspace.shelves.colorMap.pickerLabel", { name: c.label })}
                />
                {isOverridden ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground h-7 w-7 shrink-0 p-0"
                    onClick={() => onClear(mapKey)}
                    aria-label={t("workspace.shelves.colorMap.resetOne", { name: c.label })}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <span className="h-7 w-7 shrink-0" aria-hidden />
                )}
              </li>
            );
          })}
        </ul>
      </div>
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
