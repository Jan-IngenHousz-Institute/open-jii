import { z } from "zod";

export const zWalkingStrategy = z.enum([
  "byRow",
  "serpentine",
  "random",
  "randomByBlock",
  "treatmentBalanced",
]);

/** What the walking order reads about each plot, until the layout carries plot attributes itself. */
export const zPlotAttributes = z.object({
  unitId: z.string().uuid(),
  treatment: z.string().nullable(),
  genotype: z.string().nullable(),
  block: z.string().nullable(),
});

export const zWalkingOrder = z.object({
  strategy: zWalkingStrategy.nullable(),
  /** Rebuilds a random order exactly. By row and serpentine follow the layout and carry none. */
  orderCode: z.string().nullable(),
  /** Unit ids in the order a phone walks them, empty until a strategy is saved. */
  order: z.array(z.string().uuid()),
  plots: z.array(zPlotAttributes),
});

/** A null order code asks the platform to draw one when a random strategy is saved. */
export const zWalkingOrderSettings = z.object({
  strategy: zWalkingStrategy,
  orderCode: z.string().min(1).max(64).nullable(),
});

export const zMeasurer = z.object({
  userId: z.string().uuid(),
  name: z.string(),
});

export const zFieldSplit = z.enum(["equalShares", "rowBands"]);

export const zFieldShare = z.object({
  userId: z.string().uuid(),
  unitIds: z.array(z.string().uuid()),
});

export const zFieldAssignments = z.object({
  split: zFieldSplit,
  shares: z.array(zFieldShare),
});

export const zDivideFieldBody = z.object({
  measurerIds: z.array(z.string().uuid()).min(2),
  split: zFieldSplit,
  shares: z.array(zFieldShare),
});

export const zMeasurerProgress = z.object({
  userId: z.string().uuid(),
  measuredUnitIds: z.array(z.string().uuid()),
  skippedUnitIds: z.array(z.string().uuid()),
  lastUploadAt: z.string().datetime().nullable(),
});

export const zSessionProgress = z.object({
  updatedAt: z.string().datetime(),
  measurers: z.array(zMeasurerProgress),
});

/** The days any session ran on, newest first. */
export const zSessionDays = z.array(z.string().date());

export const zSkipReason = z.enum(["plantMissing", "flooded", "couldNotReach", "other"]);

export const zSessionReading = z.object({
  unitId: z.string().uuid(),
  isRepeat: z.boolean(),
  /** Flagged on the platform or the phone, through a data annotation. */
  isFlagged: z.boolean(),
});

export const zSessionSkip = z.object({
  unitId: z.string().uuid(),
  reason: zSkipReason,
});

/** One measurer's session as uploaded so far. A reading outside the assignment is outside their share. */
export const zEndedSession = z.object({
  userId: z.string().uuid(),
  phone: z.string(),
  endedAt: z.string().datetime(),
  lastUploadAt: z.string().datetime().nullable(),
  isUploaded: z.boolean(),
  assignedUnitIds: z.array(z.string().uuid()),
  readings: z.array(zSessionReading),
  skips: z.array(zSessionSkip),
  /** Plots whose reading the phone gave up uploading, as it reports on its next sync. */
  failedUploadUnitIds: z.array(z.string().uuid()),
});

export const zEndedSessionsQuery = z.object({
  endedOn: z.string().date(),
});

/** One value a reading carries, as the workbook labels it. */
export const zReadingValue = z.object({
  label: z.string(),
  value: z.string(),
});

export const zMeasuredTwiceReading = z.object({
  readingId: z.string().uuid(),
  userId: z.string().uuid(),
  phone: z.string(),
  measuredAt: z.string().datetime(),
  values: z.array(zReadingValue),
});

/** Which reading stands. The others stay in the data, left out of it. */
export const zMeasuredTwiceResolution = z.object({
  keptReadingId: z.string().uuid(),
  resolvedBy: z.string().uuid(),
  resolvedAt: z.string().datetime(),
});

/** A plot more than one reading landed on without a repeat. */
export const zMeasuredTwicePlot = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid(),
  readings: z.array(zMeasuredTwiceReading),
  resolution: zMeasuredTwiceResolution.nullable(),
});

export type WalkingStrategy = z.infer<typeof zWalkingStrategy>;
export type PlotAttributes = z.infer<typeof zPlotAttributes>;
export type WalkingOrder = z.infer<typeof zWalkingOrder>;
export type WalkingOrderSettings = z.infer<typeof zWalkingOrderSettings>;
export type Measurer = z.infer<typeof zMeasurer>;
export type FieldSplit = z.infer<typeof zFieldSplit>;
export type FieldShare = z.infer<typeof zFieldShare>;
export type FieldAssignments = z.infer<typeof zFieldAssignments>;
export type DivideFieldBody = z.infer<typeof zDivideFieldBody>;
export type MeasurerProgress = z.infer<typeof zMeasurerProgress>;
export type SessionProgress = z.infer<typeof zSessionProgress>;
export type SkipReason = z.infer<typeof zSkipReason>;
export type SessionReading = z.infer<typeof zSessionReading>;
export type SessionSkip = z.infer<typeof zSessionSkip>;
export type EndedSession = z.infer<typeof zEndedSession>;
export type ReadingValue = z.infer<typeof zReadingValue>;
export type MeasuredTwiceReading = z.infer<typeof zMeasuredTwiceReading>;
export type MeasuredTwiceResolution = z.infer<typeof zMeasuredTwiceResolution>;
export type MeasuredTwicePlot = z.infer<typeof zMeasuredTwicePlot>;
