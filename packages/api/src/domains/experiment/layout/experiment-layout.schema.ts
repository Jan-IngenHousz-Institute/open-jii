import { z } from "zod";

/**
 * One place in an experiment's layout, such as a plot in a field or a tray on a bench. A position is
 * relative to the parent unit, and a unit made from a pasted list has none until one is set.
 */
export const zExperimentUnit = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  identifier: z.string().min(1).max(64),
  row: z.number().int().positive().nullable(),
  column: z.number().int().positive().nullable(),
  active: z.boolean(),
});

/** A Common Greenhouse Ontology class, the only vocabulary a unit name may be tagged with. */
export const zLayoutTerm = z.object({
  id: z.string().min(1).describe("Prefixed identifier, such as cgo:Bench"),
  label: z.string().min(1),
  iri: z.string().url(),
});

/** The outer corner of the first plot on the earth, and the grid's bearing in degrees from north. */
export const zLayoutAnchor = z.object({
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  bearing: z.number().min(0).lt(360).nullable(),
  /** One plot's size on the ground in meters, which turns a row and column into a place. */
  plotWidth: z.number().positive().nullable(),
  plotLength: z.number().positive().nullable(),
});

export const zExperimentLayout = z.object({
  levelName: z.string().min(1).max(64),
  levelTerm: zLayoutTerm.nullish(),
  anchor: zLayoutAnchor.nullish(),
  rows: z.number().int().positive().max(200),
  columns: z.number().int().positive().max(200),
  units: z.array(zExperimentUnit),
});

export const zExperimentLayoutSetup = zExperimentLayout.pick({
  levelName: true,
  levelTerm: true,
  rows: true,
  columns: true,
});

export const zLayoutTermSearchQuery = z.object({
  query: z.string().min(2).max(100),
});

export const zLayoutTermSearchResponse = z.array(zLayoutTerm);

/** Where an attribute's value came from: the layout, a saved sheet, or a cell edited after upload. */
export const zPlotAttributeSource = z.discriminatedUnion("type", [
  z.object({ type: z.literal("layout") }),
  z.object({ type: z.literal("sheet"), sheetName: z.string().min(1) }),
  z.object({ type: z.literal("edit"), sheetName: z.string().min(1) }),
]);

export const zPlotAttribute = z.object({
  name: z.string().min(1),
  value: z.string(),
  source: zPlotAttributeSource,
});

export const zExperimentLayoutPlot = z.object({
  unit: zExperimentUnit,
  levelName: z.string().min(1).max(64),
  attributes: z.array(zPlotAttribute),
});

export const zExperimentLayoutPlotPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  plotId: z.string().uuid().describe("ID of the plot"),
});

/** The match target a metadata sheet names to be matched once, at save, against the layout's plots. */
export const LAYOUT_PLOT_MATCH_TARGET = "layout:plot";

export const zLayoutSheetPreviewBody = z.object({
  identifiers: z.array(z.string()).max(10000).describe("The sheet's identifier column, row by row"),
});

/** What saving a sheet matched by plot would do, counted against the layout's plots. */
export const zLayoutSheetPreview = z.object({
  matchedRowCount: z.number().int().nonnegative(),
  unmatchedNames: z.array(z.string()).describe("Names in the sheet that no plot carries"),
  duplicateNames: z.array(z.string()).describe("Names given to more than one row; the first wins"),
  plotsWithoutRow: z.array(z.string()),
});

/** An Ambyte gateway carries up to four sensors, numbered as its upload parser numbers them. */
export const AMBYTE_CHANNEL_COUNT = 4;

/** An onboarded device, or one channel of an Ambyte, standing on one plot for a period. */
export const zLayoutPlacement = z.object({
  id: z.string().uuid(),
  deviceId: z.string().uuid(),
  channel: z
    .number()
    .int()
    .min(1)
    .max(AMBYTE_CHANNEL_COUNT)
    .nullable()
    .describe("The Ambyte channel, or null when the whole device is placed"),
  plotId: z.string().uuid(),
  startDate: z.string().date(),
  endDate: z.string().date().nullable().describe("Null while the sensor still stands there"),
});

export const zLayoutPlacementCreate = zLayoutPlacement
  .omit({ id: true })
  .refine((placement) => placement.endDate === null || placement.endDate >= placement.startDate, {
    message: "The end date cannot be before the start date",
    path: ["endDate"],
  });

export type ExperimentUnit = z.infer<typeof zExperimentUnit>;
export type ExperimentLayout = z.infer<typeof zExperimentLayout>;
export type ExperimentLayoutSetup = z.infer<typeof zExperimentLayoutSetup>;
export type LayoutTerm = z.infer<typeof zLayoutTerm>;
export type LayoutAnchor = z.infer<typeof zLayoutAnchor>;
export type LayoutSheetPreview = z.infer<typeof zLayoutSheetPreview>;
export type LayoutPlacement = z.infer<typeof zLayoutPlacement>;
export type LayoutPlacementCreate = z.infer<typeof zLayoutPlacementCreate>;
export type PlotAttributeSource = z.infer<typeof zPlotAttributeSource>;
export type PlotAttribute = z.infer<typeof zPlotAttribute>;
export type ExperimentLayoutPlot = z.infer<typeof zExperimentLayoutPlot>;
