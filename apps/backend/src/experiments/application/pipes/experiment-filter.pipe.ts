import { z } from "@repo/validator";

const experimentFilterSchema = z.enum(["my", "member", "related"]).optional();

export type ExperimentFilter = z.infer<typeof experimentFilterSchema>;
