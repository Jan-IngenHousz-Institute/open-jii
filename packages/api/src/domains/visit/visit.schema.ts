import { z } from "zod";

export const zRecordExperimentVisitPath = z.object({
  id: z.string().uuid().describe("ID of the opened experiment"),
});

export type RecordExperimentVisitPath = z.infer<typeof zRecordExperimentVisitPath>;
