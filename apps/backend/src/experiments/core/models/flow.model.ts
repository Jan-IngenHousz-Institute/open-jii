import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { zFlowGraph } from "@repo/api";
import { flows } from "@repo/database";

export const flowGraphSchema = zFlowGraph;
export type FlowGraphDto = z.infer<typeof flowGraphSchema>;

export const flowSchema = createSelectSchema(flows).extend({
  graph: flowGraphSchema,
});
export type FlowDto = typeof flowSchema._type;
