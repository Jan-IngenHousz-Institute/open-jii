import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { protocolMacros } from "@repo/database";

// Schema for returning macro-compatible protocols
export const macroProtocolSchema = createSelectSchema(protocolMacros)
  .omit({ protocolId: true })
  .extend({
    protocol: z.object({
      id: z.string().uuid(),
      name: z.string(),
      family: z.string(),
      createdBy: z.string().uuid(),
    }),
  });

// DTOs
export type MacroProtocolDto = typeof macroProtocolSchema._type;
