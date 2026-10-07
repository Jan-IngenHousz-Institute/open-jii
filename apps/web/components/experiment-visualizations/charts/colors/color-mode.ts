import type { ChartFormConfig, ChartFormDataConfig } from "../chart-config";

/**
 * Merge a persisted config over its chart type's `defaultConfig()` without
 * letting the defaults choose the colour mode. Only the colour shelf's column
 * picker stamps `colorMode`, so a visualization saved before that, or authored
 * through the API, arrives without one, and the scatter and bubble defaults say
 * "continuous", which draws a text colour column in black.
 *
 * A categorical-only chart type gets "categorical" here. A type that offers
 * continuous colour keeps the mode unset, and its renderer decides from the
 * colour column's type.
 *
 * Call this while building a form's `defaultValues`, never from an effect:
 * `useAutosave` anchors on the first render's value, so a later write would save
 * the visualization just because someone opened it.
 */
export function withResolvedColorMode(
  defaults: ChartFormConfig,
  persisted: ChartFormConfig | undefined,
  dataConfig: ChartFormDataConfig,
): ChartFormConfig {
  const merged: ChartFormConfig = { ...defaults, ...persisted };
  if (persisted?.colorMode !== undefined) {
    return merged;
  }
  delete merged.colorMode;
  const hasColorColumn = dataConfig.dataSources.some((source) => source.role === "color");
  if (hasColorColumn && defaults.colorMode === undefined) {
    merged.colorMode = "categorical";
  }
  return merged;
}
