import { z } from "zod";

import {
  experimentFlowGraphFields,
  refineExperimentFlowGraph,
  zExperimentFlowGraph,
  zExperimentIdPathParam,
} from "../experiment.schema";

export const zExperimentFlow = z.object({
  id: z.string().uuid(),
  experimentId: z.string().uuid(),
  graph: zExperimentFlowGraph,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zExperimentUpsertFlowBody = zExperimentFlowGraph;

/**
 * oRPC composes the path id and request body into one input object. Keep that
 * route envelope strict explicitly instead of intersecting the id with the
 * standalone strict graph schema.
 */
export const zExperimentFlowRouteInput = z
  .object({
    id: zExperimentIdPathParam.shape.id,
    ...experimentFlowGraphFields,
  })
  .strict()
  .superRefine(refineExperimentFlowGraph);

export type ExperimentFlow = z.infer<typeof zExperimentFlow>;
export type ExperimentUpsertFlowBody = z.infer<typeof zExperimentUpsertFlowBody>;
export type ExperimentFlowRouteInput = z.infer<typeof zExperimentFlowRouteInput>;
