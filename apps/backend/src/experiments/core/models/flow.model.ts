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

/**
 * Discriminated result of materializing workbook cells into a flow: either a
 * valid graph to upsert, or `none` (empty workbook) meaning the flow row should
 * be deleted. Lives in core so the binding repository and the materialization
 * use case share one shape without a core -> application dependency.
 */
export type FlowMaterialization = { kind: "flow"; graph: FlowGraphDto } | { kind: "none" };
