import { randomUUID } from "node:crypto";

import { db } from "../../src/database";
import { experimentDashboards, experimentVisualizations } from "../../src/schema";
import { CONTRIBUTOR_SEEDS } from "./constants";
import type { SeedExperiment, SeedUser } from "./types";

type VisualizationRow = typeof experimentVisualizations.$inferInsert;
type Layout = { col: number; row: number; colSpan: number; rowSpan: number };

// The lakehouse is unreachable locally, so these charts render their empty or error
// states; the point is the dashboard editor, its layouts and every widget type.
const TABLE = "raw_data";

const source = (columnName: string, role: string) => ({ tableName: TABLE, columnName, role });

const VISUALIZATIONS: Omit<VisualizationRow, "experimentId" | "createdBy">[] = [
  {
    name: "Phi2 over the season",
    chartFamily: "basic",
    chartType: "line",
    config: {
      mode: "lines",
      line: { width: 2, smoothing: 0 },
      xAxisType: "date",
      showLegend: true,
    },
    dataConfig: { tableName: TABLE, dataSources: [source("timestamp", "x"), source("phi2", "y")] },
  },
  {
    name: "NPQt against light, coloured by device",
    chartFamily: "basic",
    chartType: "scatter",
    config: {
      mode: "markers",
      marker: { size: 6, colorscale: "Viridis", showscale: true },
      colorMode: "categorical",
      xAxisTitle: "PAR",
      yAxisTitle: "NPQt",
    },
    dataConfig: {
      tableName: TABLE,
      dataSources: [
        source("light_intensity", "x"),
        source("npqt", "y"),
        source("device_id", "color"),
      ],
    },
  },
  {
    name: "Measurements per plot",
    chartFamily: "basic",
    chartType: "bar",
    config: {},
    dataConfig: { tableName: TABLE, dataSources: [source("plot", "x"), source("id", "y")] },
  },
  {
    name: "Distribution of Phi2",
    chartFamily: "statistical",
    chartType: "histogram",
    config: {},
    dataConfig: { tableName: TABLE, dataSources: [source("phi2", "x")] },
  },
  {
    name: "LEF by treatment",
    chartFamily: "statistical",
    chartType: "box-plot",
    config: {},
    dataConfig: { tableName: TABLE, dataSources: [source("treatment", "x"), source("lef", "y")] },
  },
  {
    name: "Leaf temperature by plot and hour",
    chartFamily: "scientific",
    chartType: "heatmap",
    config: {},
    dataConfig: {
      tableName: TABLE,
      dataSources: [source("plot", "x"), source("hour", "y"), source("leaf_temperature", "z")],
    },
  },
];

const at = (col: number, row: number, colSpan: number, rowSpan: number): Layout => ({
  col,
  row,
  colSpan,
  rowSpan,
});

const titled = { showTitle: true, showDescription: true };

/**
 * Charts and dashboards on the seed experiments, shaped like the ones people build on dev
 * and prod: a rich overview with every widget type, a compact custom layout, an empty
 * dashboard, and one made by a contributor rather than the seed user.
 */
export async function seedDashboards(user: SeedUser, createdExperiments: SeedExperiment[]) {
  const [main, second] = createdExperiments;
  const [contributor] = CONTRIBUTOR_SEEDS;

  const charts = await db
    .insert(experimentVisualizations)
    .values(VISUALIZATIONS.map((v) => ({ ...v, experimentId: main.id, createdBy: user.id })))
    .returning({ id: experimentVisualizations.id });
  const chart = (index: number, layout: Layout) => ({
    id: randomUUID(),
    type: "visualization" as const,
    layout,
    config: { visualizationId: charts[index].id, ...titled },
  });

  const overview = [
    {
      id: randomUUID(),
      type: "richText" as const,
      layout: at(0, 0, 12, 3),
      config: {
        html: "<h2>Field trial overview</h2><p>Every widget type on one page. The charts recompute live from the raw data.</p><table><tr><th>Check</th><th>Result</th></tr><tr><td>Plots measured</td><td>24 of 24</td></tr></table>",
      },
    },
    {
      id: randomUUID(),
      type: "filter" as const,
      layout: at(0, 3, 4, 2),
      config: {
        tableName: TABLE,
        column: "device_id",
        operator: "equals",
        title: "Device",
        description: "Isolate one handheld",
        ...titled,
      },
    },
    {
      id: randomUUID(),
      type: "filter" as const,
      layout: at(4, 3, 4, 2),
      config: {
        tableName: TABLE,
        column: "treatment",
        operator: "equals",
        title: "Treatment",
        description: "Watered or drought",
        ...titled,
      },
    },
    ...VISUALIZATIONS.map((_, index) =>
      chart(index, at((index % 2) * 6, 5 + Math.floor(index / 2) * 5, 6, 5)),
    ),
    {
      id: randomUUID(),
      type: "table" as const,
      layout: at(0, 20, 12, 5),
      config: {
        tableName: TABLE,
        columns: ["timestamp", "device_id", "plot", "treatment", "phi2", "npqt", "lef"],
        pageSize: 25,
        title: "Latest measurements",
        description: "Newest first",
        ...titled,
      },
    },
  ];

  const rows: (typeof experimentDashboards.$inferInsert)[] = [
    {
      experimentId: main.id,
      name: "Field trial overview",
      description: "Every widget type, laid out the way most dashboards are",
      widgets: overview,
      createdBy: user.id,
    },
    {
      experimentId: main.id,
      name: "Compact layout",
      description: "Shorter rows and a tighter gap than the default",
      layout: { columns: 12, rowHeight: 50, gap: 12 },
      widgets: [
        {
          id: randomUUID(),
          type: "richText",
          layout: at(0, 0, 12, 2),
          config: { html: "<p>Two charts side by side.</p>" },
        },
        chart(0, at(0, 2, 6, 6)),
        chart(1, at(6, 2, 6, 6)),
      ],
      createdBy: user.id,
    },
    { experimentId: main.id, name: "Untitled dashboard", widgets: [], createdBy: user.id },
    {
      experimentId: (second ?? main).id,
      name: "A contributor's dashboard",
      description: "Made by someone other than the seed user",
      widgets: [
        {
          id: randomUUID(),
          type: "richText",
          layout: at(0, 0, 12, 3),
          config: { html: "<p>Notes from the field team.</p>" },
        },
      ],
      createdBy: contributor.id,
    },
  ];

  await db.insert(experimentDashboards).values(rows);
  console.log(`  Created ${charts.length} visualizations and ${rows.length} dashboards`);
}
