import type { ChartFormConfig, ChartFormDataConfig } from "../chart-config";

/**
 * Give a persisted config an explicit `colorMode` when it has a colour column
 * but no mode. Only the colour shelf's column picker stamps the field, so a
 * visualization saved before that, or authored through the API, arrives without
 * one and leaves every reader inferring it.
 *
 * Charts that support continuous colour carry `colorMode` in their own
 * `defaultConfig()`, so once those defaults are merged in, a colour column with
 * no mode can only belong to a categorical-only chart type.
 *
 * Call this while building a form's `defaultValues`, never from an effect:
 * `useAutosave` anchors on the first render's value, so a later write would save
 * the visualization just because someone opened it.
 */
export function withResolvedColorMode(
  config: ChartFormConfig,
  dataConfig: ChartFormDataConfig,
): ChartFormConfig {
  if (config.colorMode !== undefined) {
    return config;
  }
  const hasColorColumn = dataConfig.dataSources.some((source) => source.role === "color");
  if (!hasColorColumn) {
    return config;
  }
  return { ...config, colorMode: "categorical" };
}
