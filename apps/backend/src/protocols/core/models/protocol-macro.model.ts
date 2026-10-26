import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { protocolMacros } from "@repo/database";

// Schema for returning protocol-compatible macros
export const protocolMacroSchema = createSelectSchema(protocolMacros)
  .omit({ macroId: true })
  .extend({
    macro: z.object({
      id: z.string().guid(),
      name: z.string(),
      filename: z.string(),
      language: z.enum(["python", "r", "javascript"]),
      createdBy: z.string().guid(),
    }),
  });

// DTOs
export type ProtocolMacroDto = z.infer<typeof protocolMacroSchema>;
