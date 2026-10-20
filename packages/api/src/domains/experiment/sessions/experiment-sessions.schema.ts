import { z } from "zod";

export const zWalkingStrategy = z.enum([
  "byRow",
  "serpentine",
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
  seed: z.string().nullable(),
  /** Unit ids in the order a phone walks them, empty until a strategy is saved. */
  order: z.array(z.string().uuid()),
  plots: z.array(zPlotAttributes),
});

/** A null seed asks the platform to draw one when the strategy is saved. */
export const zWalkingOrderSettings = z.object({
  strategy: zWalkingStrategy,
  seed: z.string().min(1).max(64).nullable(),
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
  seed: z.string(),
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

export const zSkipReason = z.enum(["plantMissing", "flooded", "couldNotReach", "other"]);

export const zSessionReading = z.object({
  unitId: z.string().uuid(),
  isRepeat: z.boolean(),
});

export const zSessionSkip = z.object({
  unitId: z.string().uuid(),
  reason: zSkipReason,
});

/** One measurer's session as uploaded so far. A reading outside the assignment is off-plan. */
export const zEndedSession = z.object({
  userId: z.string().uuid(),
  phone: z.string(),
  endedAt: z.string().datetime(),
  lastUploadAt: z.string().datetime().nullable(),
  isUploaded: z.boolean(),
  assignedUnitIds: z.array(z.string().uuid()),
  readings: z.array(zSessionReading),
  skips: z.array(zSessionSkip),
});

export const zEndedSessionsQuery = z.object({
  endedOn: z.string().date(),
});

export const zConflictReading = z.object({
  userId: z.string().uuid(),
  phone: z.string(),
  measuredAt: z.string().datetime(),
});

export const zPlotConflict = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid(),
  readings: z.array(zConflictReading),
  resolvedAt: z.string().datetime().nullable(),
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
export type ConflictReading = z.infer<typeof zConflictReading>;
export type PlotConflict = z.infer<typeof zPlotConflict>;
