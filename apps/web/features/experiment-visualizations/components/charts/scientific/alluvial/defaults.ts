import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { makeDataSource } from "../../data/data-sources";

export function alluvialDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    showLegend: false,
    showGrid: false,
    useWebGL: false,
    alluvialNodeThickness: 20,
    alluvialNodePadding: 15,
    // 0.4 lets overlapping flows still read clearly without obscuring
    // each other; the canonical sankey examples sit around this value.
    alluvialLinkOpacity: 0.4,
    alluvialColorMode: "stage",
    alluvialHideLabels: false,
  };
}

export function alluvialDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // Alluvial needs >= 2 stages to render any flow, so seed two groupBy
  // drafts plus an optional value column (blank by default; if filled,
  // the renderer sums it per link instead of counting rows).
  return {
    tableName: table,
    dataSources: [
      makeDataSource(table, "groupBy"),
      makeDataSource(table, "groupBy"),
      makeDataSource(table, "value"),
    ],
  };
}
