import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { zExperimentFlowGraph } from "@repo/api/domains/experiment/experiment.schema";
import { flows } from "@repo/database";

export const flowGraphSchema = zExperimentFlowGraph;
export type FlowGraphDto = z.infer<typeof flowGraphSchema>;

export const flowSchema = createSelectSchema(flows).extend({
  graph: flowGraphSchema,
});
export type FlowDto = typeof flowSchema._type;
