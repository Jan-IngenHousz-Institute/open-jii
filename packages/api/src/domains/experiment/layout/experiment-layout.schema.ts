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

export const zExperimentLayout = z.object({
  levelName: z.string().min(1).max(64),
  rows: z.number().int().positive().max(200),
  columns: z.number().int().positive().max(200),
  units: z.array(zExperimentUnit),
});

export const zExperimentLayoutSetup = zExperimentLayout.pick({
  levelName: true,
  rows: true,
  columns: true,
});

export type ExperimentUnit = z.infer<typeof zExperimentUnit>;
export type ExperimentLayout = z.infer<typeof zExperimentLayout>;
export type ExperimentLayoutSetup = z.infer<typeof zExperimentLayoutSetup>;
