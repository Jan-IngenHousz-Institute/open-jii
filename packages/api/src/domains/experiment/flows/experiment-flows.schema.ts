import { z } from "zod";

import { zExperimentFlowGraph } from "../experiment.schema";

export const zExperimentFlow = z.object({
  id: z.string().uuid(),
  experimentId: z.string().uuid(),
  graph: zExperimentFlowGraph,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zExperimentUpsertFlowBody = zExperimentFlowGraph;

export type ExperimentFlow = z.infer<typeof zExperimentFlow>;
export type ExperimentUpsertFlowBody = z.infer<typeof zExperimentUpsertFlowBody>;
