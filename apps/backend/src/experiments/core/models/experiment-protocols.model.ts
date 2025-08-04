import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { experimentProtocols } from "@repo/database";

// Schema for returning experiment protocols
export const experimentProtocolSchema = createSelectSchema(experimentProtocols)
  .omit({ protocolId: true })
  .extend({
    protocol: z.object({
      id: z.string().uuid(),
      name: z.string(),
      family: z.enum(["multispeq", "ambit"]),
      createdBy: z.string().uuid(),
    }),
  });

// DTOs
export type ExperimentProtocolDto = z.infer<typeof experimentProtocolSchema>;
