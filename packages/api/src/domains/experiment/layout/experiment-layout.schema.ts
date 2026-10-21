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
  /** Readings bound to the plot. An inactive plot with readings was removed after measuring. */
  readingCount: z.number().int().nonnegative().optional(),
});

/** A Common Greenhouse Ontology class, the only vocabulary a unit name may be tagged with. */
export const zLayoutTerm = z.object({
  id: z.string().min(1).describe("Prefixed identifier, such as cgo:Bench"),
  label: z.string().min(1),
  iri: z.string().url(),
});

const zLatitude = z.number().min(-90).max(90);
const zLongitude = z.number().min(-180).max(180);

/**
 * Where the field sits: the experiment location it belongs to, then two clicked corners along row
 * A, which give the grid's bearing and the spacing between columns, and the spacing between rows.
 * Each part is optional, and the location alone already says where the experiment ran.
 */
export const zLayoutAnchor = z.object({
  locationId: z.string().uuid().nullable().describe("An experiment location, picked or created"),
  corner: z.object({ latitude: zLatitude, longitude: zLongitude }).nullable(),
  rowEnd: z
    .object({ latitude: zLatitude, longitude: zLongitude })
    .nullable()
    .describe("The outer corner at the far end of row A"),
  /** Meters from the start of one row to the start of the next, paths included. */
  rowSpacing: z.number().positive().nullable(),
});

/** How generated plots are named: A1 to F8, a running number such as 101 to 148, or 1-1 to 6-8. */
export const zLayoutNaming = z.enum(["rowLetter", "runningNumber", "rowColumn"]);

/** The largest field on each side, so a layout holds 40,000 plots at most. */
export const LAYOUT_MAX_SIDE = 200;

export const zExperimentLayout = z.object({
  levelName: z.string().min(1).max(64),
  levelTerm: zLayoutTerm.nullish(),
  anchor: zLayoutAnchor.nullish(),
  rows: z.number().int().positive().max(LAYOUT_MAX_SIDE),
  columns: z.number().int().positive().max(LAYOUT_MAX_SIDE),
  naming: zLayoutNaming.nullish().describe("Null when the names came from a pasted list"),
  firstNumber: z.number().int().nonnegative().nullish(),
  /** Readings in the experiment that carry a plot, so a matched sheet can say whether any joined. */
  readingCount: z.number().int().nonnegative().optional(),
  units: z.array(zExperimentUnit),
});

export const zExperimentLayoutSetup = z.object({
  levelName: z.string().min(1).max(64),
  levelTerm: zLayoutTerm.nullish(),
  rows: z.number().int().positive().max(LAYOUT_MAX_SIDE),
  columns: z.number().int().positive().max(LAYOUT_MAX_SIDE),
  naming: zLayoutNaming,
  firstNumber: z.number().int().nonnegative(),
});

export const zLayoutTermSearchQuery = z.object({
  query: z.string().min(2).max(100),
});

export const zLayoutTermSearchResponse = z.array(zLayoutTerm);

/** Where an attribute's value came from: a saved sheet, or a cell edited after upload. */
export const zPlotAttributeSource = z.discriminatedUnion("type", [
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

/** Every plot's attribute values at once, which Color by draws on the grid. */
export const zLayoutAttributes = z.object({
  names: z.array(z.string().min(1)).describe("Attribute names in the order the sheet gave them"),
  plots: z.array(
    z.object({
      unitId: z.string().uuid(),
      values: z.record(z.string(), z.string()),
    }),
  ),
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
  readingsWithPlot: z
    .number()
    .int()
    .nonnegative()
    .describe("Readings that carry a plot, and so will show the sheet's values"),
});

/** An Ambyte gateway carries up to four sensors, one per port, numbered 1 to 4 as on the device. */
export const AMBYTE_CHANNEL_COUNT = 4;

/** Device families that stand in a field and can be placed on a plot. A handheld is never placed. */
export const PLACEABLE_DEVICE_TYPES: readonly string[] = ["ambyte"];

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

export const zLayoutPlacementListQuery = z.object({
  deviceId: z.string().uuid().optional(),
  plotId: z.string().uuid().optional(),
});

export const zLayoutPlacementList = z.array(zLayoutPlacement);

export const zLayoutPlacementCreate = zLayoutPlacement
  .omit({ id: true })
  .refine((placement) => placement.endDate === null || placement.endDate >= placement.startDate, {
    message: "The end date cannot be before the start date",
    path: ["endDate"],
  });

export type ExperimentUnit = z.infer<typeof zExperimentUnit>;
export type ExperimentLayout = z.infer<typeof zExperimentLayout>;
export type ExperimentLayoutSetup = z.infer<typeof zExperimentLayoutSetup>;
export type LayoutNaming = z.infer<typeof zLayoutNaming>;
export type LayoutTerm = z.infer<typeof zLayoutTerm>;
export type LayoutAnchor = z.infer<typeof zLayoutAnchor>;
export type LayoutSheetPreview = z.infer<typeof zLayoutSheetPreview>;
export type LayoutPlacement = z.infer<typeof zLayoutPlacement>;
export type LayoutPlacementCreate = z.infer<typeof zLayoutPlacementCreate>;
export type PlotAttributeSource = z.infer<typeof zPlotAttributeSource>;
export type PlotAttribute = z.infer<typeof zPlotAttribute>;
export type ExperimentLayoutPlot = z.infer<typeof zExperimentLayoutPlot>;
export type LayoutAttributes = z.infer<typeof zLayoutAttributes>;
