import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { protocolMacros } from "@repo/database";

// Schema for returning protocol-compatible macros
export const protocolMacroSchema = createSelectSchema(protocolMacros)
  .omit({ macroId: true })
  .extend({
    macro: z.object({
      id: z.string().uuid(),
      name: z.string(),
      filename: z.string(),
      language: z.enum(["python", "r", "javascript"]),
      createdBy: z.string().uuid(),
    }),
  });

// DTOs
export type ProtocolMacroDto = typeof protocolMacroSchema._type;
