import { z } from "zod";

/** The resource types a visit can be recorded for. */
export const zVisitResourceType = z.enum(["experiment"]);

export const zRecordVisitBody = z.object({
  resourceType: zVisitResourceType,
  resourceId: z.string().uuid().describe("ID of the opened resource"),
});

export type VisitResourceType = z.infer<typeof zVisitResourceType>;
export type RecordVisitBody = z.infer<typeof zRecordVisitBody>;
